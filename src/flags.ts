// deno-lint-ignore-file no-explicit-any
import { z } from "./z.ts";

export function flag<
  Schema extends z.ZodSchema<any>,
  Aliases extends Readonly<string>
>(
  schema: Schema,
  config: {
    aliases?: Aliases[];
    negatable?: boolean;
    hidden?: boolean;
  } = {}
): Flag<Schema, Aliases> {
  let longDescription: string | undefined;

  const extras = {
    aliases: config.aliases ?? [],
    negatable: !!config.negatable,
    hidden: config.hidden ?? false,
    get longDescription() {
      return longDescription;
    },
    complete() {
      const type = innerType(schema);

      if (type instanceof z.ZodEnum || type instanceof z.ZodNativeEnum) {
        return type._def.values.map((val: unknown) => "" + val);
      }

      return [];
    },
    __flag: true as const,
    __global: false,
  };

  return Object.assign(schema, {
    ...extras,
    // @ts-expect-error: blah blah
    describe(description: string) {
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

export function flags<Shape extends FlagsShape>(shape: Shape): Flags<Shape> {
  // @ts-expect-error: it's fine, great actually
  return Object.assign(z.object(shape).strict(), {
    __flags: true,
    __global: false,
    merge(merging: GlobalFlags<Shape>) {
      const merged: any = new z.ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () =>
          // @ts-expect-error: it's fine, great actually
          z.objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
        typeName: z.ZodFirstPartyTypeKind.ZodObject,
      }) as any;

      merged.__global = false;
      merged.__flags = true;
      return merged;
    },
  });
}

export function globalFlags<Shape extends FlagsShape>(
  shape: Shape
): GlobalFlags<Shape> {
  walkFlags(flags(shape as any), (schema) => {
    schema.__global = true;
  });

  // @ts-expect-error: it's fine, great actually
  return Object.assign(z.object(shape).strict(), {
    __flags: true,
    __global: true,
    merge(merging: GlobalFlags<Shape>) {
      const merged: any = new z.ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () =>
          // @ts-expect-error: it's fine, great actually
          z.objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
        typeName: z.ZodFirstPartyTypeKind.ZodObject,
      }) as any;

      walkFlags(merged, (schema) => {
        schema.__global = true;
      });

      merged.__global = true;
      merged.__flags = true;
      return merged;
    },
  });
}

/**
 * Returns `true` if the given schema is a flag.
 * @param schema - The object to check
 */
export function isFlag(schema: unknown): schema is Flag<any, any> {
  return schema instanceof z.ZodType && "__flag" in schema;
}

/**
 * Returns `true` if the given schema is a global flag.
 * @param schema - The object to check
 */
export function isGlobalFlag(schema: unknown): schema is Flag<any, any> {
  return isFlag(schema) && !!schema.__global;
}

/**
 * Returns `true` if the given schema is a flags object.
 * @param schema - The object to check
 */
export function isFlags(schema: unknown): schema is Flags {
  return schema instanceof z.ZodObject && "__flags" in schema;
}

/**
 * Returns `true` if the given schema is a global flags object.
 * @param schema - The object to check
 */
export function isGlobalFlags(schema: unknown): schema is GlobalFlags {
  return isFlags(schema) && !!schema.__global;
}

/**
 * Find the inner type of a flag or flags object.
 *
 * @param schema - The schema to find the inner type of
 */
export function innerType<T>(schema: T): z.ZodTypeAny | T {
  // ZodOptional -> _def.innerType
  // ZodArray -> _def.type
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return innerType(schema._def.innerType);
  } else if (schema instanceof z.ZodArray) {
    return innerType(schema._def.type);
  }

  return schema;
}

/**
 * Find the default value of a flag.
 *
 * @param schema - The schema to find the default value of
 */
export function getDefault<T extends Flag<z.ZodTypeAny, string>>(
  schema: T
): inferFlag<T> | undefined {
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  return;
}

/**
 * Return the type of a flag as a string.
 *
 * @param schema - The schema to find the type of
 */
export function typeAsString(schema: Flag<z.ZodTypeAny, string>): string {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return typeAsString(schema._def.innerType);
  } else if (schema instanceof z.ZodArray) {
    return `${typeAsString(schema._def.type)}[]`;
  } else if (schema instanceof z.ZodUnion) {
    return schema._def.options
      .map((o: z.ZodTypeAny) => typeAsString(o as any))
      .join(" | ");
  } else if (schema instanceof z.ZodIntersection) {
    return (
      typeAsString(schema._def.left) + " & " + typeAsString(schema._def.right)
    );
  } else if (schema instanceof z.ZodObject) {
    return "object";
  } else if (schema instanceof z.ZodTuple) {
    return `[${schema._def.items
      .map((i: z.ZodTypeAny) => typeAsString(i as any))
      .join(", ")}]`;
  } else if (schema instanceof z.ZodRecord) {
    return `record<${typeAsString(schema._def.keyType)}, ${typeAsString(
      schema._def.valueType
    )}>`;
  } else if (schema instanceof z.ZodLiteral) {
    return JSON.stringify(schema._def.value);
  } else if (schema instanceof z.ZodEnum) {
    return schema._def.values
      .map((v: unknown) =>
        v instanceof z.ZodType ? typeAsString(v as any) : JSON.stringify(v)
      )
      .join(", ");
  } else if (schema instanceof z.ZodNativeEnum) {
    return Object.keys(schema._def.values).join(", ");
  } else if (schema instanceof z.ZodNullable) {
    return `${typeAsString(schema._def.innerType)} | null`;
  } else if (schema instanceof z.ZodUndefined) {
    return "undefined";
  } else if (schema instanceof z.ZodString) {
    return "string";
  } else if (schema instanceof z.ZodNumber) {
    return "number";
  } else if (schema instanceof z.ZodBigInt) {
    return "bigint";
  } else if (schema instanceof z.ZodBoolean) {
    return "boolean";
  } else if (schema instanceof z.ZodDate) {
    return "date";
  }

  return "";
}

/**
 * Walk a flags object and call a function for each flag that is found.
 *
 * @param schema - The schema to walk
 * @param visitor - The function to call for each flag
 */
export function walkFlags<Schema extends Flags | unknown = unknown>(
  schema: Schema,
  visitor: (
    schema: Flag<z.ZodTypeAny, string>,
    name: Extract<
      Schema extends Flags | OptionalFlags
        ? keyof inferFlags<Schema>
        : Record<string, unknown>,
      string
    >
  ) => void
) {
  // Eliminate the tail call above
  // This looks dumb now but might add more stuff e.g. nested opts later
  // @ts-expect-error: it's fine
  const stack: [Flags | OptionalFlags, string][] = schema ? [[schema, ""]] : [];

  while (stack.length > 0) {
    const [s, baseName] = stack.pop()!;
    // @ts-expect-error: it works
    for (const [name, prop] of Object.entries(innerType(s).shape)) {
      const type = innerType(prop);

      if (isFlags(type)) {
        stack.push([type as any, baseName ? `${baseName}.${name}` : name]);
      } else if (isFlag(prop)) {
        visitor(prop, (baseName ? `${baseName}.${name}` : name) as any);
      }
    }
  }
}

export type Flag<
  Schema extends z.ZodTypeAny,
  Aliases extends Readonly<string>
> = {
  aliases: Readonly<Aliases[]>;
  negatable: boolean;
  hidden: boolean;
  describe(description: string): Flag<Schema, Aliases>;
  description: string | undefined;
  long(description: string): Flag<Schema, Aliases>;
  longDescription: string | undefined;
  complete(): string[];
  _def: Schema["_def"];
  _output: Schema["_output"];
  __flag: true;
  __global: boolean;
};

export type Flags<Shape extends FlagsShape = FlagsShape> = Pick<
  z.ZodObject<
    // @ts-expect-error: it's fine
    Shape,
    "strict"
  >,
  "_output" | "_def" | "shape"
> & {
  merge<Incoming extends Flags<any>>(
    merging: Incoming
  ): Flags<
    z.ZodObject<
      z.extendShape<Shape, ReturnType<Incoming["_def"]["shape"]>>,
      Incoming["_def"]["unknownKeys"],
      Incoming["_def"]["catchall"]
    >["shape"]
  >;
  default(
    shape: z.ZodObject<
      // @ts-expect-error: it's fine
      Shape,
      "strict"
    >["_input"]
  ): Flags<Shape>;
  optional(): OptionalFlags<Shape>;
  __flags: true;
  __global: boolean;
};

export type OptionalFlags<Shape extends FlagsShape = FlagsShape> = Pick<
  // @ts-expect-error: it's fine
  z.ZodOptional<z.ZodObject<Shape, "strict">>,
  "_output" | "_def"
> & {
  __optional: true;
};

export type GlobalFlags<Shape extends FlagsShape = FlagsShape> = Flags<Shape>;

export type FlagsShape = Record<
  string,
  Flag<z.ZodTypeAny, string> | Flags<any> | OptionalFlags<any>
>;

export type FlagAliases<T extends { aliases: ReadonlyArray<string> }> =
  T["aliases"] extends ReadonlyArray<infer Names>
    ? Names extends string
      ? Names
      : never
    : never;

export type inferFlags<T extends Flags | OptionalFlags> = T["_output"];
export type inferFlag<T extends Flag<any, any>> = T["_output"];
