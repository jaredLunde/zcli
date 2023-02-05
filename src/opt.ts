// deno-lint-ignore-file no-explicit-any
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";
import { isArray } from "./lib/is-array.ts";

export function opt<
  Name extends Readonly<string>,
  Aliases extends Readonly<string>,
  Conflicts extends Readonly<string>,
  Schema extends z.ZodSchema<any>,
  DefaultValue extends Schema extends z.ZodDefault<infer Default>
    ? z.infer<Default>
    : undefined,
  Negatable extends boolean
>({
  name,
  aliases,
  conflicts,
  schema,
  negatable,
}: {
  name: Name;
  aliases?: Aliases[];
  conflicts?: Conflicts[];
  schema: Schema;
  negatable?: Negatable;
}): Opt<Name, Aliases, Conflicts, Schema, DefaultValue, Negatable> {
  const jsonSchema = zodToJsonSchema(schema as any, {
    target: "jsonSchema7",
    strictUnions: true,
    effectStrategy: "input",
  });
  const optional =
    "anyOf" in jsonSchema && jsonSchema.anyOf?.some((s) => !("type" in s));
  const collect = isArray(jsonSchema);

  return {
    names: [name, ...(aliases ?? [])] as const,
    conflicts: conflicts ?? [],
    // @ts-expect-error: we are smarter than the typescript
    optional,
    // @ts-expect-error: we are smarter than the typescript
    collect,
    // @ts-expect-error: we are smarter than the typescript
    negatable: !!negatable,
    parse: schema.parse,
    defaultValue: jsonSchema.default
      ? schema.parse(jsonSchema.default)
      : jsonSchema.default,
    schema: {
      zod: schema,
      json: jsonSchema,
    },
  };
}

export type Opt<
  Name extends Readonly<string>,
  Aliases extends Readonly<string>,
  Conflicts extends Readonly<string>,
  Schema extends z.ZodSchema<any>,
  DefaultValue extends Schema extends z.ZodDefault<infer Default>
    ? z.infer<Default>
    : undefined,
  Negatable extends boolean
> = {
  names: Readonly<[Name, ...Aliases[]]>;
  conflicts: Conflicts[];
  optional: Schema extends z.ZodOptional<any> ? true : false;
  collect: z.infer<Schema> extends any[] ? true : false;
  negatable: Negatable;
  parse: Schema["parse"];
  defaultValue: DefaultValue;
  schema: {
    zod: Schema;
    json: ReturnType<typeof zodToJsonSchema>;
  };
};

export type InferOptSchema<T extends { schema: { zod: z.ZodSchema<any> } }> =
  z.infer<T["schema"]["zod"]>;

export type InferOptConflicts<T extends { conflicts: Readonly<string>[] }> =
  T["conflicts"] extends ReadonlyArray<infer Conflicts> ? Conflicts : never;

export type InferOptNames<
  T extends { names: Readonly<[Readonly<string>, ...Readonly<string>[]]> }
> = T["names"] extends ReadonlyArray<infer Names> ? Names : never;

export type InferOptName<T extends { names: Readonly<[string, ...string[]]> }> =
  T["names"][0];

export type InferOptAliases<
  T extends { names: Readonly<[Readonly<string>, ...Readonly<string>[]]> }
> = T["names"] extends Readonly<[string, ...Array<infer Names>]>
  ? Names extends string
    ? Names
    : never
  : never;

export type InferOptDefaultValue<T extends { defaultValue: any }> =
  T["defaultValue"];
