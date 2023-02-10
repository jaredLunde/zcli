// deno-lint-ignore-file no-explicit-any
import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";

export const isArray = is("array", (jsonSchema) => {
  return !("enum" in jsonSchema);
});
export const isBoolean = is("boolean");
export const isString = is("string");
export const isNumber = is("number");
export const isInteger = is("integer");
export const isEnum = is(
  ["array", "string", "number", "boolean", "integer"],
  (jsonSchema) => {
    return "enum" in jsonSchema;
  }
);

function is(
  schemaType: SchemaType | SchemaType[],
  and: (jsonSchema: ReturnType<typeof zodToJsonSchema>) => boolean = () => true
) {
  const t = Array.isArray(schemaType) ? schemaType : [schemaType];
  return (jsonSchema: ReturnType<typeof zodToJsonSchema>): boolean => {
    return (
      // Required type
      ("type" in jsonSchema &&
        t.includes(jsonSchema.type as any) &&
        and(jsonSchema)) ||
      // Optional type
      ("anyOf" in jsonSchema &&
        jsonSchema.anyOf?.some((s, _i, arr) => {
          return (
            arr.length === 2 &&
            "type" in s &&
            t.includes(s.type as any) &&
            and(s)
          );
        }))
    );
  };
}

type SchemaType = "array" | "boolean" | "string" | "number" | "integer";
