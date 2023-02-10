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
  } = {}
) {
  const extras = {
    aliases: config.aliases ?? [],
    negatable: !!config.negatable,
    __opt: true as const,
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

export function isOpt(schema: z.ZodTypeAny): schema is Opt<any, any> {
  return "__opt" in schema;
}

export function walkOpts<Schema extends OptsObject>(
  schema: Schema,
  visitor: (
    schema: Opt<z.ZodTypeAny, string>,
    name: Extract<keyof z.infer<Schema>, string>
  ) => void
) {
  // Eliminate the tail call above
  const stack: z.ZodObject<
    Record<string, Opt<z.ZodTypeAny, string>>,
    "strict"
  >[] = schema instanceof z.ZodUnion ? schema.options : [schema];

  while (stack.length > 0) {
    const s = stack.pop()!;

    for (const [name, prop] of Object.entries(s.shape)) {
      if (isOpt(prop)) {
        visitor(prop, name as any);
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
  __opt: true;
};

export type OptsObject =
  | z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">
  | z.ZodUnion<
      [
        z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">,
        ...z.ZodObject<Record<string, Opt<z.ZodTypeAny, string>>, "strict">[]
      ]
    >;

export type OptAliases<T extends { aliases: ReadonlyArray<string> }> =
  T["aliases"] extends ReadonlyArray<infer Names>
    ? Names extends string
      ? Names
      : never
    : never;
