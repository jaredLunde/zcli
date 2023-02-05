// deno-lint-ignore-file no-explicit-any
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";
import { isArray } from "./lib/is-array.ts";
import { InferOptDefaultValue, InferOptName, InferOptSchema } from "./opt.ts";

export function arg<
  Name extends Readonly<string>,
  Schema extends z.ZodSchema<any>,
  DefaultValue extends Schema extends z.ZodDefault<infer Default>
    ? z.infer<Default>
    : undefined
>({
  name,
  schema,
}: {
  name: Name;
  schema: Schema;
}): Arg<Name, Schema, DefaultValue> {
  const jsonSchema = zodToJsonSchema(schema as any, {
    target: "jsonSchema7",
    strictUnions: true,
    effectStrategy: "input",
  });
  const optional =
    "anyOf" in jsonSchema && jsonSchema.anyOf?.some((s) => !("type" in s));
  const variadic = isArray(jsonSchema);

  return {
    names: [name] as const,
    // @ts-expect-error: we are smarter than the typescript
    optional,
    // @ts-expect-error: we are smarter than the typescript
    variadic,
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

export type Arg<
  Name extends Readonly<string>,
  Schema extends z.ZodSchema<any>,
  DefaultValue extends Schema extends z.ZodDefault<infer Default>
    ? z.infer<Default>
    : undefined
> = {
  names: Readonly<[Name]>;
  optional: Schema extends z.ZodOptional<any> ? true : false;
  variadic: z.infer<Schema> extends any[] ? true : false;
  parse: Schema["parse"];
  defaultValue: DefaultValue;
  schema: {
    zod: Schema;
    json: ReturnType<typeof zodToJsonSchema>;
  };
};

export type InferArgSchema<T extends { schema: { zod: z.ZodSchema<any> } }> =
  InferOptSchema<T>;

export type InferArgName<T extends { names: Readonly<[string, ...string[]]> }> =
  InferOptName<T>;

export type InferArgDefaultValue<T extends { defaultValue: any }> =
  InferOptDefaultValue<T>;
