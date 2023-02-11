// deno-lint-ignore-file no-explicit-any
import { z } from "./z.ts";

export function opt<
  Schema extends z.ZodSchema<any>,
  Aliases extends Readonly<string>
>(
  schema: Schema,
  config: {
    aliases?: Aliases[];
    negatable?: boolean;
    hidden?: boolean;
  } = {}
) {
  const extras = {
    aliases: config.aliases ?? [],
    negatable: !!config.negatable,
    hidden: config.hidden ?? false,
    __opt: true as const,
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
  });
}

export function opts<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object(shape).strict();
}

export function globalOpts<Shape extends z.ZodRawShape>(shape: Shape) {
  for (const key in shape) {
    const o = shape[key];

    if (isOpt(o)) {
      // @ts-expect-error: oy
      o.__global = true;
    }
  }

  return z.object(shape).strict();
}

export function isOpt(schema: z.ZodTypeAny): schema is Opt<any, any> {
  return "__opt" in schema;
}

export function isGlobalOpt(
  schema: z.ZodTypeAny
): schema is Opt<any, any> & { __global: true } {
  return "__global" in schema && !!schema.__global;
}

export function innerType(schema: z.ZodTypeAny): z.ZodTypeAny {
  // ZodOptional -> _def.innerType
  // ZodArray -> _def.type
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return innerType(schema._def.innerType);
  } else if (schema instanceof z.ZodArray) {
    return innerType(schema._def.type);
  }

  return schema;
}

export function getDefault(schema: z.ZodTypeAny) {
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  return undefined;
}

export function typeAsString(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return typeAsString(schema._def.innerType);
  } else if (schema instanceof z.ZodArray) {
    return `${typeAsString(schema._def.type)}[]`;
  } else if (schema instanceof z.ZodUnion) {
    return schema._def.options
      .map((o: z.ZodTypeAny) => typeAsString(o))
      .join(" | ");
  } else if (schema instanceof z.ZodIntersection) {
    return (
      typeAsString(schema._def.left) + " & " + typeAsString(schema._def.right)
    );
  } else if (schema instanceof z.ZodObject) {
    return "object";
  } else if (schema instanceof z.ZodTuple) {
    return `[${schema._def.items
      .map((i: z.ZodTypeAny) => typeAsString(i))
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
        v instanceof z.ZodType ? typeAsString(v) : JSON.stringify(v)
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

export function walkOpts<Schema extends OptsObject | unknown = unknown>(
  schema: Schema,
  visitor: (
    schema: Opt<z.ZodTypeAny, string>,
    name: Extract<
      Schema extends OptsObject
        ? keyof z.infer<Schema>
        : Record<string, unknown>,
      string
    >
  ) => void
) {
  // Eliminate the tail call above
  // This looks dumb now but might add more stuff e.g. nested opts later
  // @ts-expect-error: it's fine
  const stack: [
    z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, any>,
    string
  ][] = schema ? [[schema, ""]] : [];

  while (stack.length > 0) {
    const [s, baseName] = stack.pop()!;

    for (const [name, prop] of Object.entries(s.shape)) {
      const type = innerType(prop);

      if (type instanceof z.ZodObject) {
        stack.push([type, baseName ? `${baseName}.${name}` : name]);
      } else if (isOpt(prop)) {
        visitor(prop, (baseName ? `${baseName}.${name}` : name) as any);
      }
    }
  }
}

export type Opt<
  Schema extends z.ZodSchema<any>,
  Aliases extends Readonly<string>
> = Schema & {
  aliases: Readonly<Aliases[]>;
  negatable: boolean;
  hidden: boolean;
  __opt: true;
  __global: boolean;
};

export type OptsObject = z.ZodObject<
  Record<string, Opt<z.ZodTypeAny, string>>,
  "strict"
>;

export type GlobalOptsObject = z.ZodObject<
  Record<string, Opt<z.ZodTypeAny, string>>,
  "strict"
>;

export type OptAliases<T extends { aliases: ReadonlyArray<string> }> =
  T["aliases"] extends ReadonlyArray<infer Names>
    ? Names extends string
      ? Names
      : never
    : never;
