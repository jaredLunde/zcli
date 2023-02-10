// deno-lint-ignore-file no-explicit-any ban-types
import * as flags from "https://deno.land/std@0.177.0/flags/mod.ts";
import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";
import { Merge } from "https://deno.land/x/typefest@0.16.0/mod.ts";
import { Arg, ArgsTuple } from "./arg.ts";
import { isArray, isBoolean, isEnum, isString } from "./lib/json-schema.ts";
import { OptsObject, walkOpts } from "./opt.ts";
import { omit } from "./lib/omit.ts";
import { Prettify } from "./lib/types.ts";
import { z } from "./z.ts";
import { EnvError } from "./env.ts";
import { isHelp, writeHelp } from "./help.ts";
import { dedent } from "./lib/dedent.ts";
import {
  Cell,
  TextTable,
} from "https://deno.land/x/indent_and_wrap@v0.0.17/mod.ts";

export function cmd<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
        Arg<string, z.ZodTypeAny>,
        Arg<string, z.ZodTypeAny>[],
        Arg<string, z.ZodTypeAny> | null
      >
    | unknown = unknown,
  Opts extends OptsObject | unknown = unknown
>(
  name: string,
  { args, cmds, opts }: CmdConfig<Context, Args, Opts> = {}
): Cmd<Context, Args, Opts> {
  let action: Action<Context, Args, Opts> | undefined;
  let description = "";

  const hasOptionalArgs =
    args instanceof z.ZodOptional || args instanceof z.ZodDefault;
  const hasArgs = args instanceof z.ZodTuple || hasOptionalArgs;
  const variadicArg = !hasArgs
    ? null
    : hasOptionalArgs
    ? args._def.innerType._def.rest
    : args._def.rest;
  const argsItems =
    hasOptionalArgs && args._def.innerType instanceof z.ZodTuple
      ? args._def.innerType.items
      : args instanceof z.ZodTuple
      ? args.items
      : [];

  const hasOpts = opts instanceof z.ZodUnion || opts instanceof z.ZodObject;

  function help(): string[] {
    const usage =
      "Usage:\n" +
      (cmds?.length ? `  ${name} [command]\n` : "") +
      `  ${name} ${[
        hasArgs ? (hasOptionalArgs ? "[arg]" : "<arg>") : "",
        hasOpts ? "[flags]" : "",
      ]
        .filter(Boolean)
        .join(" ")}`;

    const { columns } = Deno.consoleSize();
    let flags = "";

    if (hasOpts) {
      flags = "Flags:\n";
      const rows: Cell[][] = [];
      const jsonSchema: any = zodToJsonSchema(opts as any, {
        target: "jsonSchema7",
        strictUnions: true,
        effectStrategy: "input",
      });

      const properties =
        ("type" in jsonSchema &&
          jsonSchema.type === "object" &&
          "properties" in jsonSchema &&
          jsonSchema?.properties) ||
        ("anyOf" in jsonSchema &&
          Object.assign(
            // @ts-expect-error: balh blah
            ...(jsonSchema as { anyOf: Record<string, unknown>[] }).anyOf.map(
              (o) => (o as any).properties
            )
          ));

      walkOpts(opts, (opt, path) => {
        const property = properties[path];
        const type = property.type;

        rows.push([
          {
            content: opt.aliases.map((a) => `-${a}, `).join(""),
            options: { paddingLeft: 2 },
          },
          {
            content: `--${path} ${type === "boolean" ? "" : type}`,
            options: { paddingLeft: 2 },
          },
          {
            content:
              "" +
              opt.description +
              (isEnum(property) ? ` {${property.enum.join("|")}}` : "") +
              (property.default !== undefined && type !== "boolean"
                ? ` (default: ${property.default})`
                : ""),
            options: { paddingLeft: 2 },
          },
        ]);
      });

      flags += new TextTable(rows, {
        borderWidth: 0,
        mode: "term",
        tabsToSpaces: true,
        maxWidth: columns,
      });
    }

    return [!!description && dedent(description), "", usage, "", flags].filter(
      (s): s is string => s !== false
    );
  }

  return {
    name,

    get description() {
      return description;
    },

    describe(str: string) {
      description = str;
      return this;
    },

    help,

    run(action_) {
      action = action_;
      return this;
    },

    async parse(argv = Deno.args, ctx) {
      if (cmds?.length) {
        const [cmd, ...rest] = argv;
        const match = cmds.find((c) => c.name === cmd);

        if (match) {
          return await match.parse(rest, ctx);
        }
      }

      try {
        const optsSchema =
          hasOpts &&
          zodToJsonSchema(opts as any, {
            target: "jsonSchema7",
            strictUnions: true,
            effectStrategy: "input",
          });

        const boolean: string[] = [];
        const string: string[] = [];
        const collect: string[] = [];
        const negatable: string[] = [];
        const alias: Record<string, readonly string[]> = {};

        if (hasOpts) {
          const optsSchemaProperties = !optsSchema
            ? {}
            : ("type" in optsSchema &&
                optsSchema.type === "object" &&
                "properties" in optsSchema &&
                optsSchema?.properties) ||
              ("anyOf" in optsSchema &&
                Object.assign(
                  // @ts-expect-error: balh blah
                  ...(
                    optsSchema as { anyOf: Record<string, unknown>[] }
                  ).anyOf.map((o) => o.properties)
                ));

          const optsSchemaKeys = Object.keys(optsSchemaProperties);

          for (const k of optsSchemaKeys) {
            const value = (optsSchemaProperties as any)[k];

            if (isBoolean(value)) {
              boolean.push(k);
            }

            if (isString(value)) {
              string.push(k);
            }

            if (isArray(value)) {
              collect.push(k);
            }
          }

          walkOpts(opts, (schema, name) => {
            if (schema.negatable) {
              negatable.push(name);
            }

            if (schema.aliases.length > 0) {
              alias[name] = schema.aliases;
            }
          });
        }

        const flagOpt: flags.ParseOptions = {
          boolean,
          string,
          collect,
          negatable,
          alias,
          "--": true,
        };

        const aliases = Object.values(alias).flat();

        const { _, ...parsed } = flags.parse(argv, flagOpt);
        const doubleDash = parsed["--"]!;
        delete parsed["--"];

        // Parse the options
        const o = hasOpts && (await opts.parseAsync(omit(parsed, aliases)));

        // Parse the arguments
        const a: Record<string, unknown> = variadicArg
          ? { [variadicArg.name]: [] }
          : {};

        for (const item of argsItems) {
          if (item && "name" in item && item.name === variadicArg?.name) {
            a[item.name] = [];
          }
        }

        if (hasArgs) {
          const defaultArgs =
            _.length === 0 && args instanceof z.ZodOptional
              ? undefined
              : _.length === 0 && args instanceof z.ZodDefault
              ? args._def.defaultValue()
              : _;
          const parsedArgs = (await args.parseAsync(defaultArgs)) ?? [];

          for (let i = 0; i < parsedArgs.length; i++) {
            const arg = parsedArgs[i];
            const item = argsItems[i];

            if (item && item.name === variadicArg?.name) {
              const collect = a[item.name];

              if (!collect) {
                a[item.name] = [arg];
              } else if (Array.isArray(collect)) {
                collect.push(arg);
              }
            } else if (item) {
              a[item.name] = arg;
            } else if (variadicArg) {
              const collect = a[variadicArg.name];

              if (!collect) {
                a[variadicArg.name] = [arg];
              } else if (Array.isArray(collect)) {
                collect.push(arg);
              }
            }
          }
        }

        // Run the action
        await action?.({ ...a, ...o, "--": doubleDash }, ctx!);
      } catch (err) {
        if (err instanceof EnvError) {
          await Deno.stderr.write(new TextEncoder().encode(err.message));
          Deno.exit(1);
        }

        if (isHelp(err)) {
          await writeHelp(help());
        }

        throw err;
      }
    },
  };
}

export type Cmd<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
        Arg<string, z.ZodTypeAny>,
        Arg<string, z.ZodTypeAny>[],
        Arg<string, z.ZodTypeAny> | null
      >
    | unknown = unknown,
  Opts extends OptsObject | unknown = unknown
> = {
  /**
   * The name of the command
   */
  name: string;
  /**
   * The description of the command
   */
  description?: string;
  /**
   * Returns the help text for the command
   */
  help(): string[];
  /**
   * Add a subcommand to the command
   * @param description The description of the command
   */
  describe(description: string): Cmd<Context, Args, Opts>;
  /**
   * Run this action when the command is invoked
   * @param action The action to run when the command is invoked
   */
  run(action: Action<Context, Args, Opts>): Cmd<Context, Args, Opts>;
  /**
   * Parse `Deno.args` and run the command
   * @param argv The arguments to parse
   */
  parse: Parse<Context>;
};

export type CmdConfig<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
        Arg<string, z.ZodTypeAny>,
        Arg<string, z.ZodTypeAny>[],
        Arg<string, z.ZodTypeAny> | null
      >
    | unknown = unknown,
  Opts extends OptsObject | unknown = unknown
> = {
  /**
   * Add arguments to the command
   */
  args?: Args;
  /**
   * Add options to the command
   */
  opts?: Opts;
  /**
   * Add subcommands to the command
   */
  cmds?: Cmd<Context>[];
  /**
   * Command metadata
   */
  meta?: Meta;
};

export type Action<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
        Arg<string, z.ZodTypeAny>,
        Arg<string, z.ZodTypeAny>[],
        Arg<string, z.ZodTypeAny> | null
      >
    | unknown = unknown,
  Opts extends OptsObject | unknown = unknown
> = {
  /**
   * The action to run when the command is invoked
   * @param argopts The parsed arguments and options
   * @param ctx The context object
   */
  (
    argopts: Prettify<
      Merge<
        ArgsMap<Args>,
        (Opts extends OptsObject ? z.infer<Opts> : {}) & { "--": string[] }
      >
    >,
    ctx: Context
  ): Promise<void> | void;
};

export type Parse<Context> = {
  (args: string[], ctx?: Context): Promise<void>;
};

export type ArgsMap<
  Args extends
    | ArgsTuple<
        Arg<string, z.ZodTypeAny>,
        Arg<string, z.ZodTypeAny>[],
        Arg<string, z.ZodTypeAny> | null
      >
    | unknown = unknown
> = Args extends ArgsTuple<infer ZodType, infer ZodTypes, infer VariadicType>
  ? Merge<
      Args extends z.ZodOptional<any>
        ? Partial<ArgsTupleMap<ZodType, ZodTypes>>
        : ArgsTupleMap<ZodType, ZodTypes>,
      VariadicType extends Arg<string, z.ZodTypeAny>
        ? {
            [k in VariadicType["name"]]: z.infer<VariadicType>[];
          }
        : {}
    >
  : {};

export type ArgsTupleMap<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[]
> = {
  [k in ZodType["name"]]: z.infer<ZodType>;
} & {
  [Index in Exclude<keyof ZodTypes, keyof any[]> as ZodTypes[Index] extends {
    name: string;
  }
    ? ZodTypes[Index]["name"]
    : never]: ZodTypes[Index] extends z.ZodTypeAny
    ? z.infer<ZodTypes[Index]>
    : never;
};

export type Meta = {
  usage?: string;
  examples?: string[];
};
