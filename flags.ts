// deno-lint-ignore-file no-explicit-any
import { Prettify } from "./lib/types.ts";
import { z } from "./z.ts";
import { zodProxy } from "./zod-proxy.ts";

/**
 * A flag for a command. This is just a Zod schema with an additional
 * builder.
 *
 * @param config - The configuration for the flag.
 */
export function flag(config: FlagConfig = {}) {
  const flagProps = {
    aliases: config.aliases ?? [],
    negatable: !!config.negatable,
    hidden: config.hidden ?? false,
    get shortDescription() {
      return typeof config.short === "function" ? config.short() : config.short;
    },
    get longDescription() {
      return typeof config.long === "function" ? config.long() : config.long;
    },
    deprecated: config.deprecated,
    __flag: true as const,
    __global: false,
  };

  return zodProxy(z, flagProps) as Prettify<
    FlagTypes & typeof flagProps
  >;
}

/**
 * A flags object. These flags are available to the specific commands
 * they are defined in.
 *
 * @param shape - The shape of the flags.
 */
export function flags<Shape extends FlagsShape>(shape: Shape) {
  const flagsProps = {
    __flags: true,
  };

  return zodProxy(z, flagsProps).object(shape).strict() as Flags<Shape>;
}

/**
 * Returns `true` if the given schema is a flag.
 *
 * @param schema - The object to check
 */
export function isFlag(schema: unknown): schema is Flag {
  return schema instanceof z.ZodType && "__flag" in schema;
}

/**
 * Returns `true` if the given schema is a global flag.
 *
 * @param schema - The object to check
 */
export function isGlobalFlag(schema: unknown): schema is Flag {
  return isFlag(schema) && !!schema.__global;
}

/**
 * Returns `true` if the given schema is a flags object.
 *
 * @param schema - The object to check
 */
export function isFlags(schema: unknown): schema is Flags {
  return schema instanceof z.ZodType && "__flags" in schema;
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
export function getDefault<T extends Flag>(
  schema: T,
): inferFlag<T> | undefined {
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  return;
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
    schema: Flag,
    name: Extract<
      Schema extends Flags | OptionalFlags ? keyof inferFlags<Schema>
        : Record<string, unknown>,
      string
    >,
  ) => void,
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

/**
 * Return the type of a flag as a string.
 *
 * @param schema - The schema to find the type of
 */
export function typeAsString(schema: Flag): string {
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
    return `[${
      schema._def.items
        .map((i: z.ZodTypeAny) => typeAsString(i as any))
        .join(", ")
    }]`;
  } else if (schema instanceof z.ZodRecord) {
    return `record<${typeAsString(schema._def.keyType)}, ${
      typeAsString(
        schema._def.valueType,
      )
    }>`;
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

export type Flag<Schema extends z.ZodTypeAny = z.ZodTypeAny> = {
  /**
   * The short aliases of the flag.
   */
  aliases: Readonly<string[]>;
  /**
   * The flag is negatable. This means that the flag can be prefixed with
   * `--no-` to negate it.
   */
  negatable: boolean;
  /**
   * The flag as hidden. This will prevent it from being shown in the help
   * text or in the generated completion script.
   */
  hidden: boolean;
  /**
   * The short description of the flag.
   */
  shortDescription: string | undefined;
  /**
   * The long description of the flag.
   */
  longDescription: string | undefined;
  /**
   * If `true`, this flag is deprecated.
   */
  deprecated?: boolean;
  _def: Schema["_def"];
  _output: Schema["_output"];
  __flag: true;
  __global: boolean;
};

export type Flags<Shape extends FlagsShape = FlagsShape> =
  & Pick<
    z.ZodObject<
      // @ts-expect-error: it's fine
      Shape,
      "strict"
    >,
    "_output" | "_def" | "shape"
  >
  & {
    /**
     * Merge another flags object into this one.
     *
     * @param merging - The flags to merge into this flags object
     */
    merge<Incoming extends Flags<any>>(
      merging: Incoming,
    ): Flags<
      z.ZodObject<
        z.extendShape<Shape, ReturnType<Incoming["_def"]["shape"]>>,
        Incoming["_def"]["unknownKeys"],
        Incoming["_def"]["catchall"]
      >["shape"]
    >;
    /**
     * Set the default value of the flags object.
     *
     * @param shape - The default shape of the flags object
     */
    default(
      shape: z.ZodObject<
        // @ts-expect-error: it's fine
        Shape,
        "strict"
      >["_input"],
    ): Flags<Shape>;
    /**
     * Make this flags object optional.
     */
    optional(): OptionalFlags<Shape>;
    __flags: true;
  };

export type OptionalFlags<Shape extends FlagsShape = FlagsShape> =
  & Pick<
    // @ts-expect-error: it's fine
    z.ZodOptional<z.ZodObject<Shape, "strict">>,
    "_output" | "_def"
  >
  & {
    __optional: true;
  };

export type FlagsShape = {
  [k: string]: z.ZodTypeAny | Flags<any> | OptionalFlags<any>;
};

export type FlagConfig = {
  /**
   * A short description of the flag.
   */
  short?: string | (() => string);
  /**
   * A long description of the flag.
   */
  long?: string | (() => string);
  /**
   * Add short aliases for the flag.
   * @example
   * ```ts
   * const flags = flags({
   *  verbose: flag('verbose', { aliases: ['v'] })
   * })
   * ```
   */
  aliases?: string[];
  /**
   * Make the flag negatable. This is only available for boolean flags.
   * A negated flag will be set to `false` when passed. For example, `--no-verbose`
   * will set a `verbose` to `false`.
   */
  negatable?: boolean;
  /**
   * Hide the flag from the help and autocomoplete output.
   * This is useful for flags that are used internally.
   */
  hidden?: boolean;
  /**
   * Mark the flag as deprecated. This will show a warning when the flag is used.
   * It will also hide the flag from the help and autocomplete output.
   *
   * @example
   * ```ts
   * flags({
   *  verbose: flag({
   *    deprecated: 'Use --log-level instead'
   *  })
   *    .boolean()
   *    .default(false)
   * })
   * ```
   */
  deprecated?: string;
};

export type FlagTypes = Pick<
  typeof z,
  | "any"
  | "array"
  | "bigint"
  | "boolean"
  | "coerce"
  | "custom"
  | "date"
  | "discriminatedUnion"
  | "enum"
  | "lazy"
  | "literal"
  | "nativeEnum"
  | "number"
  | "object"
  | "oboolean"
  | "onumber"
  | "ostring"
  | "pipeline"
  | "preprocess"
  | "quotelessJson"
  | "record"
  | "set"
  | "string"
  | "tuple"
  | "union"
  | "unknown"
>;

export type inferFlags<T extends { _output: any }> = T["_output"];
export type inferFlag<T extends Flag> = T["_output"];
