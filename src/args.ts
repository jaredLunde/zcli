// deno-lint-ignore-file no-explicit-any
import { z } from "./z.ts";

/**
 * A positional argument for a command. This is just a Zod schema
 * with additional properties.
 *
 * @param name - The name of the argument.
 * @param schema - The schema for the argument.
 */
export function arg<
  Name extends Readonly<string>,
  Schema extends z.ZodSchema<any>,
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
        extras,
      );
    },
    long(description: string): any {
      longDescription = description;
      return this;
    },
  });
}

/**
 * An arguments tuple for a command. This is just a `ZodTuple` where
 * each element is an `Arg` and `.rest()` is a variadic `Arg`.
 *
 * @param zodType - The Zod schema for the arguments tuple.
 */
export function args<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
>(zodType: [ZodType, ...ZodTypes]): ArgsWithoutVariadic<ZodType, ZodTypes> {
  // @ts-expect-error: it's fine
  return z.tuple(zodType);
}

export function isArg(schema: unknown): schema is Arg<any, any> {
  return schema instanceof z.ZodType && "__arg" in schema;
}

export function isArgs(schema: unknown): schema is Args<any, any, any> {
  return (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodTuple
  );
}

export function walkArgs(
  args: unknown,
  callback: (
    arg: Arg<any, any>,
    meta: { position: number; variadic: boolean },
  ) => void,
) {
  const hasArgs = isArgs(args);

  if (!hasArgs) {
    return;
  }

  const hasOptionalArgs = args instanceof z.ZodOptional ||
    args instanceof z.ZodDefault;
  const variadicArg = !hasArgs
    ? null
    : hasOptionalArgs
    ? args._def.innerType._def.rest
    // @ts-expect-error: it's fine
    : args._def.rest;
  const argsItems = hasOptionalArgs && args._def.innerType instanceof z.ZodTuple
    ? args._def.innerType.items
    : args instanceof z.ZodTuple
    ? args.items
    : [];

  if (argsItems.length) {
    for (let i = 0; i < argsItems.length; i++) {
      const arg = argsItems[i];
      callback(arg, { position: i, variadic: false });
    }

    if (variadicArg) {
      callback(variadicArg, { position: argsItems.length, variadic: true });
    }
  }
}

export type Arg<
  Name extends Readonly<string>,
  Schema extends z.ZodTypeAny,
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
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
> =
  & Pick<
    // @ts-expect-error: blah blah
    | z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>
    // @ts-expect-error: blah blah
    | z.ZodOptional<z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>>,
    "_def" | "_output"
  >
  & {
    /**
     * Make the arguments in the tuple optional.
     */
    optional(): OptionalArgsWithoutVariadic<ZodType, ZodTypes>;
    rest<Rest extends Arg<string, z.ZodTypeAny>>(
      rest: Rest,
    ): ArgsWithVariadic<ZodType, ZodTypes, Rest>;
    __args: true;
  };

export type OptionalArgsWithoutVariadic<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
> = ArgsWithoutVariadic<ZodType, ZodTypes> & {
  __optional: true;
};

export type ArgsWithVariadic<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny>,
> =
  & Pick<
    // @ts-expect-error: blah blah
    | z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>
    // @ts-expect-error: blah blah
    | z.ZodOptional<z.ZodTuple<[ZodType, ...ZodTypes], VariadicType>>,
    "_def" | "_output"
  >
  & {
    /**
     * Make the arguments in the tuple optional.
     */
    optional(): OptionalArgsWithVariadic<ZodType, ZodTypes, VariadicType>;
  };

export type OptionalArgsWithVariadic<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny>,
> = ArgsWithVariadic<ZodType, ZodTypes, VariadicType> & {
  __optional: true;
};

export type Args<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
  VariadicType extends Arg<string, z.ZodTypeAny> | null = null,
> = VariadicType extends Arg<string, z.ZodTypeAny>
  ? ArgsWithVariadic<ZodType, ZodTypes, VariadicType>
  : ArgsWithoutVariadic<ZodType, ZodTypes>;

export type ArgName<T extends { name: Readonly<string> }> = T["name"];
export type inferArg<T extends Arg<string, z.ZodTypeAny>> = T["_output"];
export type inferArgs<T extends Args<any, any>> = T["_output"];
