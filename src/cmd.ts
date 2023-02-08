// deno-lint-ignore-file no-explicit-any ban-types
import * as flags from "https://deno.land/std@0.176.0/flags/mod.ts";
import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";
import { Merge } from "https://deno.land/x/typefest@0.16.0/mod.ts";
import { Arg, ArgsTuple } from "./arg.ts";
import { isArray, isBoolean, isString } from "./lib/json-schema.ts";
import { isOpt, Opt, OptsObject } from "./opt.ts";
import { omit } from "./lib/omit.ts";
import { Prettify } from "./lib/types.ts";
import { z } from "./z.ts";
import { EnvError } from "./env.ts";

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
  const hasArgs =
    args instanceof z.ZodTuple ||
    args instanceof z.ZodOptional ||
    args instanceof z.ZodDefault;
  const variadicArg = !hasArgs
    ? null
    : args instanceof z.ZodOptional || args instanceof z.ZodDefault
    ? args._def.innerType._def.rest
    : args._def.rest;
  const argsItems =
    (args instanceof z.ZodOptional || args instanceof z.ZodDefault) &&
    args._def.innerType instanceof z.ZodTuple
      ? args._def.innerType.items
      : args instanceof z.ZodTuple
      ? args.items
      : [];
  const hasOpts = opts instanceof z.ZodUnion || opts instanceof z.ZodObject;
  const argsSchema =
    hasArgs &&
    zodToJsonSchema(args as any, {
      target: "jsonSchema7",
      strictUnions: true,
      effectStrategy: "input",
    });

  const optsSchema =
    hasOpts &&
    zodToJsonSchema(opts as any, {
      target: "jsonSchema7",
      strictUnions: true,
      effectStrategy: "input",
    });

  const optsSchemaProperties = !optsSchema
    ? {}
    : ("type" in optsSchema &&
        optsSchema.type === "object" &&
        "properties" in optsSchema &&
        optsSchema?.properties) ||
      ("anyOf" in optsSchema &&
        Object.assign(
          // @ts-expect-error: balh blah
          ...(optsSchema as { anyOf: Record<string, unknown>[] }).anyOf.map(
            (o) => o.properties
          )
        ));

  const optsSchemaKeys = Object.keys(optsSchemaProperties);
  const boolean: string[] = [];
  const string: string[] = [];
  const collect: string[] = [];
  const negatable: string[] = [];
  const alias: Record<string, readonly string[]> = {};

  for (const k of optsSchemaKeys) {
    if (isBoolean((optsSchemaProperties as any)[k])) {
      boolean.push(k);
    }

    if (isString((optsSchemaProperties as any)[k])) {
      string.push(k);
    }

    if (isArray((optsSchemaProperties as any)[k])) {
      collect.push(k);
    }
  }

  if (hasOpts) {
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
  let action: Action<Context, Args, Opts> | undefined;

  return {
    name,
    description: "",

    describe(str: string) {
      this.description = str;
      return this;
    },

    jsonSchema: {
      args: argsSchema || undefined,
      opts: optsSchema || undefined,
    },

    run(action_) {
      action = action_;
      return this;
    },

    async parse(argv = Deno.args, ctx) {
      if (cmds?.length) {
        const [cmd, ...rest] = argv;
        const c = cmds.find((c) => c.name === cmd);

        if (c) {
          return await c.parse(rest, ctx);
        }
      }

      const { ...parsed } = flags.parse(argv, flagOpt);
      const doubleDash = parsed["--"]!;
      const _ = parsed._;
      delete parsed["--"];
      // @ts-expect-error: it's fine
      delete parsed._;

      const o = hasOpts && (await opts.parseAsync(omit(parsed, aliases)));
      const a =
        hasArgs &&
        (
          (await args.parseAsync(
            _.length === 0 && args instanceof z.ZodOptional
              ? undefined
              : _.length === 0 && args instanceof z.ZodDefault
              ? args._def.defaultValue()
              : _
          )) ?? []
        ).reduce(
          (acc: any, a: any, i: any) => {
            const item = argsItems[i];

            if (item && item.name === variadicArg?.name) {
              acc[item.name] = (acc[item.name] ?? []).concat(a);
            } else if (item) {
              acc[item.name] = a;
            } else if (variadicArg) {
              acc[variadicArg.name] = (acc[variadicArg.name] ?? []).concat([a]);
            }

            return acc;
          },
          argsItems.reduce((acc: any, item: any) => {
            if (item && "name" in item && item.name === variadicArg?.name) {
              acc[item.name] = [];
            }

            return acc;
          }, (variadicArg ? { [variadicArg.name]: [] } : {}) as Record<string, any>)
        );

      try {
        await action?.({ ...a, ...o, "--": doubleDash }, ctx!);
      } catch (err) {
        if (err instanceof EnvError) {
          Deno.stderr.write(new TextEncoder().encode(err.message));
          Deno.exit(1);
        }

        throw err;
      }
    },
  };
}

function walkOpts<
  Schema extends
    | z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">
    | z.ZodUnion<
        [
          z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">,
          ...z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">[]
        ]
      >
>(
  schema: Schema,
  visitor: (
    schema: Opt<z.ZodTypeAny, string>,
    name: Extract<keyof z.infer<Schema>, string>
  ) => void
) {
  // Eliminate the tail call above
  const stack: z.ZodObject<
    Record<string, Opt<z.ZodTypeAny, string>>,
    "strict"
  >[] = schema instanceof z.ZodUnion ? schema.options : [schema];

  while (stack.length > 0) {
    const s = stack.pop()!;
    for (const [name, prop] of Object.entries(s.shape)) {
      if (isOpt(prop)) {
        visitor(prop, name as any);
      }
    }
  }
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
  name: string;
  description?: string;
  jsonSchema: {
    args?: ReturnType<typeof zodToJsonSchema>;
    opts?: ReturnType<typeof zodToJsonSchema>;
  };
  describe(description: string): Cmd<Context>;
  run(action: Action<Context, Args, Opts>): Cmd<Context, Args, Opts>;
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
  example?: string;
  ctx?: Context;
  args?: Args;
  cmds?: Cmd<Context, any, any>[];
  opts?: Opts;
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
