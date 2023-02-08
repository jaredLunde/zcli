// deno-lint-ignore-file no-explicit-any
import { z } from "./z.ts";

export function arg<
  Name extends Readonly<string>,
  Schema extends z.ZodSchema<any>
>(name: Name, schema: Schema): Arg<Name, Schema> {
  return Object.assign(schema, { name, __arg: true as const });
}

export function args<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[]
>(zodType: [ZodType, ...ZodTypes]) {
  return z.tuple(zodType);
}

export function isArg(schema: z.ZodTypeAny): schema is Arg<any, any> {
  return "__arg" in schema;
}

export type Arg<
  Name extends Readonly<string>,
  Schema extends z.ZodTypeAny
> = Schema & {
  name: Name;
  __arg: true;
};

export type ArgsTuple<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny> | null = null
> =
  | z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>
  | z.ZodOptional<z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>>
  | z.ZodDefault<z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>>;

export type ArgName<T extends { name: Readonly<string> }> = T["name"];
