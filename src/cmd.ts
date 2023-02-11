// deno-lint-ignore-file no-explicit-any ban-types
import * as flags from "https://deno.land/std@0.177.0/flags/mod.ts";
import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";
import { Arg, ArgsTuple } from "./arg.ts";
import { isArray, isBoolean, isString } from "./lib/json-schema.ts";
import { OptsObject, walkOpts, opts as opts_ } from "./opt.ts";
import { omit } from "./lib/omit.ts";
import { Prettify, Merge } from "./lib/types.ts";
import { z } from "./z.ts";
import { EnvError } from "./env.ts";
import { helpOpt, isHelp, writeHelp } from "./help.ts";
import { dedent } from "./lib/dedent.ts";
import { table } from "./lib/simple-table.ts";
import { colors } from "./fmt.ts";
import { pluralForm, formatList, collate } from "./lib/intl.ts";
import { didYouMean } from "./lib/did-you-mean.ts";

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
  {
    args,
    cmds,
    opts,
    aliases = [],
    hidden = false,
  }: CmdConfig<Context, Args, Opts> = {}
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
  const mergedOpts = opts
    ? (opts as unknown as z.ZodObject<any>).merge(helpOpts).strict()
    : helpOpts;
  const hasCmds = !!cmds?.length;

  function* help(path: string[] = []): Iterable<string> {
    const displayName = path.join(" ") || name;

    if (description) {
      for (const line of dedent(description)) {
        yield line;
      }

      yield "";
    }

    yield colors.bold("Usage");

    const hasAvailableCmds = hasCmds && !cmds.every((cmd) => cmd.hidden);

    if (hasAvailableCmds) {
      yield `  ${displayName} [command]`;
    }

    let argsUsage = hasArgs
      ? argsItems.reduce(
          (acc: string, arg: Arg<any, any>) =>
            acc +
            `${hasOptionalArgs ? "[" : "<"}${arg.name}${
              hasOptionalArgs ? "] " : "> "
            }`,
          ""
        )
      : "";

    if (variadicArg) {
      argsUsage += `[${variadicArg.name}...]`;
    }

    yield `  ${displayName} ${[argsUsage, "[flags]"]
      .filter(Boolean)
      .join(" ")}`;

    if (hasAvailableCmds) {
      yield colors.bold("\nAvailable commands");

      const sortedCmds = collate(cmds!, {
        get(item) {
          return item.name;
        },
      });
      const rows: string[][] = new Array(cmds.length);

      for (let i = 0; i < sortedCmds.length; i++) {
        const cmd = sortedCmds[i];

        if (!cmd.hidden) {
          rows[i] = [cmd.name, cmd.description ?? ""];
        }
      }

      for (const line of table(rows, {
        indent: 2,
        cellPadding: 2,
      })) {
        yield line;
      }
    }

    if (aliases.length) {
      yield colors.bold("\nAliases");
      yield `  ${name}, ${aliases.join(", ")}`;
    }

    const rows: string[][] = [];
    const globalRows: string[][] = [];
    const jsonSchema: any = zodToJsonSchema(mergedOpts as any, {
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

    walkOpts(mergedOpts, (opt, path) => {
      const property = properties[path];
      const type = property.type;
      const rows_ = opt.__global ? globalRows : rows;

      rows_.push([
        opt.aliases.map((a) => `-${a},`).join(" "),
        `--${path}`,
        type === "boolean"
          ? ""
          : type === "array"
          ? `${property.items.type}[]`
          : type,
        (opt.description ?? "") +
          (property.default !== undefined && type !== "boolean"
            ? ` (default: ${property.default})`
            : ""),
      ]);
    });

    if (rows.length) {
      yield colors.bold("\nFlags");

      for (const line of table(rows, {
        indent: 2,
        cellPadding: [1, 1, 2],
      })) {
        yield line;
      }
    }

    if (globalRows.length) {
      yield colors.bold("\nGlobal Flags");

      for (const line of table(globalRows, {
        indent: 2,
        cellPadding: [1, 2],
      })) {
        yield line;
      }
    }

    if (hasCmds) {
      yield `\nUse "${displayName} [command] --help" for more information about a command.`;
    }
  }

  return {
    name,
    aliases,
    hidden,
    help,

    get description() {
      return description;
    },

    describe(str: string) {
      description = str;
      return this;
    },

    run(action_) {
      action = action_;
      return this;
    },

    async parse(argv = Deno.args, ctx) {
      if (hasCmds) {
        const [cmd, ...rest] = argv;
        const match = cmds.find(
          (c) => c.name === cmd || c.aliases.includes(cmd)
        );

        if (match) {
          return await match.parse(rest, ctx);
        }
      }

      try {
        const optsSchema = zodToJsonSchema(mergedOpts as any, {
          target: "jsonSchema7",
          strictUnions: true,
          effectStrategy: "input",
        });
        const boolean: string[] = [];
        const string: string[] = [];
        const collect: string[] = [];
        const negatable: string[] = [];
        const alias: Record<string, readonly string[]> = {};
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

        for (let i = 0; i < optsSchemaKeys.length; i++) {
          const k = optsSchemaKeys[i];
          const value = (optsSchemaProperties as any)[k];
          if (isBoolean(value)) boolean.push(k);
          if (isString(value)) string.push(k);
          if (isArray(value)) collect.push(k);
        }

        walkOpts(mergedOpts, (schema, name) => {
          if (schema.negatable) negatable.push(name);
          if (schema.aliases.length > 0) alias[name] = schema.aliases;
        });

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
        let o: Record<string, unknown> = {};

        try {
          o = await mergedOpts.parseAsync(omit(parsed, aliases));
        } catch (err) {
          if (!isHelp(err) && err instanceof z.ZodError) {
            const formErrors = err.formErrors;
            const errors = err.errors.map((e) => {
              if (e.code === z.ZodIssueCode.unrecognized_keys) {
                return (
                  `Unrecognized ${pluralForm(
                    e.keys.length,
                    "flag"
                  )}: ${e.keys.join(", ")}\n` +
                  didYouMean(e.keys[0], optsSchemaKeys)
                );
              } else if (e.code === z.ZodIssueCode.invalid_type) {
                return `Invalid type for flag "${e.path.join(".")}". Expected ${
                  e.expected
                }, but received ${e.received}.`;
              } else if (e.code === z.ZodIssueCode.invalid_enum_value) {
                return `Invalid value for flag "${e.path.join(
                  "."
                )}". Expected ${formatList(
                  e.options.map((o) => "" + o),
                  {
                    type: "disjunction",
                  }
                )}. Received ${e.received}.`;
              }

              return `Invalid value for flag "${e.path.join(".")}". ${
                formErrors.fieldErrors[e.path[0]]
              }`;
            });

            await Deno.stderr.write(
              encoder.encode(
                errors[0] + `\n⚘ See --help for more information.\n`
              )
            );

            Deno.exit(1);
          }

          throw err;
        }

        // Parse the arguments
        const a: Record<string, unknown> = variadicArg
          ? { [variadicArg.name]: [] }
          : {};

        if (hasArgs) {
          const defaultArgs =
            _.length === 0 && args instanceof z.ZodOptional
              ? undefined
              : _.length === 0 && args instanceof z.ZodDefault
              ? args._def.defaultValue()
              : _;
          let parsedArgs: unknown[] = [];

          try {
            parsedArgs = (await args.parseAsync(defaultArgs)) ?? parsedArgs;
          } catch (err) {
            if (err instanceof z.ZodError) {
              const errors = err.errors.map((e) => {
                if (e.code === z.ZodIssueCode.too_small) {
                  return `expected at least ${pluralForm(
                    e.minimum,
                    "argument"
                  )} arguments`;
                } else if (e.code === z.ZodIssueCode.too_big) {
                  return `expected at most ${pluralForm(
                    e.maximum,
                    "argument"
                  )}`;
                } else if (e.code === z.ZodIssueCode.invalid_type) {
                  return `expected ${e.expected}, but received ${e.received}`;
                } else if (e.code === z.ZodIssueCode.invalid_enum_value) {
                  return `expected ${formatList(
                    e.options.map((o) => "" + o),
                    {
                      type: "disjunction",
                    }
                  )}. Received ${e.received}.`;
                }

                return e.message;
              });

              await Deno.stderr.write(
                encoder.encode(
                  `Invalid arguments: ${errors[0]}.\n⚘ See --help for more information.\n`
                )
              );

              Deno.exit(1);
            }

            throw err;
          }

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
        // @ts-expect-error: balh blah
        await action?.({ ...a, ...o, "--": doubleDash }, ctx!);
      } catch (err) {
        if (err instanceof EnvError) {
          await Deno.stderr.write(new TextEncoder().encode(err.message));
          Deno.exit(1);
        }

        if (isHelp(err)) {
          await writeHelp(help((ctx as any).path ?? []));
        }

        throw err;
      }
    },
  };
}

const encoder = new TextEncoder();
const helpOpts = opts_({
  help: helpOpt().describe("Show help for this command"),
});

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
   * The aliases of the command
   */
  aliases: string[];
  /**
   * Whether or not the command is hidden
   */
  hidden: boolean;
  /**
   * The description of the command
   */
  description?: string;
  /**
   * Returns the help text for the command
   */
  help(path?: string[]): Iterable<string>;
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
  /**
   * Aliases for the command
   */
  aliases?: string[];
  /**
   * Hide this command from the help text
   */
  hidden?: boolean;
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
    ctx: Prettify<Context>
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
