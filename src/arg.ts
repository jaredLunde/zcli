// deno-lint-ignore-file no-explicit-any
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";

export function arg<
  Name extends Readonly<string>,
  Schema extends z.ZodSchema<any>
>(name: Name, schema: Schema): Arg<Name, Schema> {
  return Object.assign(schema, {
    name,
  });
}

export function args<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[]
>(zodType: [ZodType, ...ZodTypes]) {
  return z.tuple(zodType);
}

export type Arg<
  Name extends Readonly<string>,
  Schema extends z.ZodTypeAny
> = Schema & {
  name: Name;
};

export type InferArgName<T extends { name: Readonly<string> }> = T["name"];
