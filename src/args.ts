// deno-lint-ignore-file no-explicit-any
import { z } from "./z.ts";

export function arg<
  Name extends Readonly<string>,
  Schema extends z.ZodSchema<any>
>(name: Name, schema: Schema): Arg<Name, Schema> {
  let longDescription: string | undefined;

  const extras = {
    name,
    get longDescription() {
      return longDescription;
    },
    __arg: true as const,
  };

  return Object.assign(schema, {
    ...extras,
    describe(description: string): any {
      const This = (this as any).constructor;
      return Object.assign(
        new This({
          // @ts-expect-error: blah blah
          ...this._def,
          description,
        }),
        extras
      );
    },
    long(description: string): any {
      longDescription = description;
      return this;
    },
  });
}

export function args<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[]
>(zodType: [ZodType, ...ZodTypes]): ArgsWithoutVariadic<ZodType, ZodTypes> {
  // @ts-expect-error: it's fine
  return z.tuple(zodType);
}

export function isArg(schema: unknown): schema is Arg<any, any> {
  return schema instanceof z.ZodType && "__arg" in schema;
}

export type Arg<
  Name extends Readonly<string>,
  Schema extends z.ZodTypeAny
> = Pick<Schema, "_def" | "_output" | "description"> & {
  name: Name;
  describe(description: string): Arg<Name, Schema>;
  description: string | undefined;
  long(description: string): Arg<Name, Schema>;
  longDescription: string | undefined;
  __arg: true;
};

export type ArgsWithoutVariadic<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[]
> = Pick<
  // @ts-expect-error: blah blah
  | z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>
  // @ts-expect-error: blah blah
  | z.ZodOptional<z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>>,
  "_def" | "_output"
> & {
  optional(): OptionalArgsWithoutVariadic<ZodType, ZodTypes>;
  rest<Rest extends Arg<string, z.ZodTypeAny>>(
    rest: Rest
  ): ArgsWithVariadic<ZodType, ZodTypes, Rest>;
};

export type OptionalArgsWithoutVariadic<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[]
> = ArgsWithoutVariadic<ZodType, ZodTypes> & {
  __optional: true;
};

export type ArgsWithVariadic<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny>
> = Pick<
  // @ts-expect-error: blah blah
  | z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>
  // @ts-expect-error: blah blah
  | z.ZodOptional<z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>>,
  "_def" | "_output"
> & {
  optional(): OptionalArgsWithVariadic<ZodType, ZodTypes, VariadicType>;
};

export type OptionalArgsWithVariadic<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny>
> = ArgsWithVariadic<ZodType, ZodTypes, VariadicType> & {
  __optional: true;
};

export type Args<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny> | null = null
> = VariadicType extends Arg<string, z.ZodTypeAny>
  ? ArgsWithVariadic<ZodType, ZodTypes, VariadicType>
  : ArgsWithoutVariadic<ZodType, ZodTypes>;

export type ArgName<T extends { name: Readonly<string> }> = T["name"];
export type inferArg<T extends Arg<string, z.ZodTypeAny>> = T["_output"];
export type inferArgs<T extends Args<any, any>> = T["_output"];
