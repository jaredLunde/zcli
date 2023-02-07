import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";

export const isArray = is("array", (jsonSchema) => {
  return !("enum" in jsonSchema);
});
export const isBoolean = is("boolean");
export const isString = is("string");
export const isNumber = is("number");
export const isInteger = is("integer");
export const isEnum = is("array", (jsonSchema) => {
  return "enum" in jsonSchema;
});

function is(
  schemaType: "array" | "boolean" | "string" | "number" | "integer",
  and: (jsonSchema: ReturnType<typeof zodToJsonSchema>) => boolean = () => true
) {
  return (jsonSchema: ReturnType<typeof zodToJsonSchema>): boolean => {
    return (
      ("type" in jsonSchema &&
        jsonSchema.type === schemaType &&
        and(jsonSchema)) ||
      ("anyOf" in jsonSchema &&
        jsonSchema.anyOf?.some((s, _i, arr) => {
          return (
            arr.length === 2 && "type" in s && s.type === schemaType && and(s)
          );
        }))
    );
  };
}
