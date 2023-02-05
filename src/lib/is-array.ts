import { zodToJsonSchema } from "https://esm.sh/zod-to-json-schema@3.20.2";

export function isArray(
  jsonSchema: ReturnType<typeof zodToJsonSchema>
): boolean {
  return (
    ("type" in jsonSchema && jsonSchema.type === "array") ||
    ("anyOf" in jsonSchema &&
      jsonSchema.anyOf?.some((s) => {
        return "type" in s && s.type === "array";
      }))
  );
}
