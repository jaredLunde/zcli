// deno-lint-ignore-file no-explicit-any ban-types
import * as flags from "https://deno.land/std@0.176.0/flags/mod.ts";
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";
import { Merge } from "https://deno.land/x/typefest@0.16.0/mod.ts";
import { Arg } from "./arg.ts";
import { isArray, isBoolean, isString } from "./lib/json-schema.ts";
import { isOpt, Opt } from "./opt.ts";

export function cmd<
  Context extends Record<string, unknown> | undefined = undefined,
  ZodType extends Arg<string, z.ZodTypeAny> | unknown = unknown,
  ZodTypes extends Arg<string, z.ZodTypeAny>[] = [],
  VariadicType extends Arg<string, z.ZodTypeAny> | null = null,
  Opts extends
    | z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">
    | z.ZodUnion<
        [
          z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">,
          ...z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">[]
        ]
      >
    | unknown = unknown
>(
  name: string,
  {
    ctx,
    args,
    cmds,
    opts,
    run,
  }: {
    example?: string;
    ctx?: Context;
    // @ts-expect-error: unknown is not assignable to ZodType
    args?: z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>;
    cmds?: Cmd<Context>[];
    opts?: Opts;
    run: (
      argopts: Prettify<
        Merge<
          ZodType extends Arg<any, z.ZodTypeAny>
            ? TupleToMap<ZodType, ZodTypes, VariadicType>
            : {},
          (Opts extends
            | z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">
            | z.ZodUnion<
                [
                  z.ZodObject<
                    Record<string, Opt<z.ZodTypeAny, string>>,
                    "strict"
                  >,
                  ...z.ZodObject<
                    Record<string, Opt<z.ZodTypeAny, string>>,
                    "strict"
                  >[]
                ]
              >
            ? z.infer<Opts>
            : {}) & { "--": string[] }
        >
      >,
      ctx: Context
    ) => Promise<void> | void;
  }
): Cmd<Context> {
  const hasArgs = args instanceof z.ZodTuple;
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
    async parse(argv = Deno.args, ctx: Context) {
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
        ((await args.parseAsync(_)) as any[]).reduce((acc, a, i) => {
          const item = args.items[i] as any;

          if (item && item.name === args._def.rest?.name) {
            acc[item.name] = (acc[item.name] ?? []).concat(a);
          } else if (item) {
            acc[item.name] = a;
          } else {
            acc[args._def.rest!.name] = (
              acc[args._def.rest!.name] ?? []
            ).concat([a]);
          }

          return acc;
        }, {} as Record<string, any>);

      await run({ ...a, ...o, "--": doubleDash }, ctx);
    },
  };
}

export type Cmd<Context> = {
  name: string;
  description?: string;
  jsonSchema: {
    args?: ReturnType<typeof zodToJsonSchema>;
    opts?: ReturnType<typeof zodToJsonSchema>;
  };
  describe(description: string): Cmd<Context>;
  parse(args: string[], ctx?: Context): Promise<void>;
};

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

function omit(obj: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key))
  );
}

export type TupleToMap<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny> | null
> = Merge<
  {
    [k in ZodType["name"]]: z.infer<ZodType>;
  } & {
    [Index in Exclude<keyof ZodTypes, keyof any[]> as ZodTypes[Index] extends {
      name: string;
    }
      ? ZodTypes[Index]["name"]
      : never]: ZodTypes[Index] extends z.ZodTypeAny
      ? z.infer<ZodTypes[Index]>
      : never;
  },
  VariadicType extends Arg<string, z.ZodTypeAny>
    ? {
        [k in VariadicType["name"]]: z.infer<VariadicType>[];
      }
    : {}
>;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
