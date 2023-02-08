// deno-lint-ignore-file no-explicit-any
import { z } from "./z.ts";

export function opt<
  Schema extends z.ZodSchema<any>,
  Aliases extends Readonly<string>,
>(
  schema: Schema,
  config: {
    aliases?: Aliases[];
    negatable?: boolean;
  } = {},
) {
  return Object.assign(schema, {
    aliases: config.aliases ?? [],
    negatable: !!config.negatable,
    __opt: true as const,
  });
}

export function opts<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object(shape).strict();
}

export function isOpt(schema: z.ZodTypeAny): schema is Opt<any, any> {
  return "__opt" in schema;
}

export type Opt<
  Schema extends z.ZodSchema<any>,
  Aliases extends Readonly<string>,
> = Schema & {
  aliases: Readonly<Aliases[]>;
  negatable: boolean;
  __opt: true;
};

export type OptsObject =
  | z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">
  | z.ZodUnion<
    [
      z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">,
      ...z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">[],
    ]
  >;

export type OptAliases<T extends { aliases: ReadonlyArray<string> }> =
  T["aliases"] extends ReadonlyArray<infer Names> ? Names extends string ? Names
    : never
    : never;
