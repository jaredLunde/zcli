// deno-lint-ignore-file no-explicit-any
import { Prettify } from "./lib/types.ts";
import { z } from "./z.ts";
import { zodProxy } from "./zod-proxy.ts";

/**
 * Add arguments to a command.
 *
 * @param config - Configuration for the arguments.
 */
export function args(
  config: ArgsConfig = {},
) {
  const argsProps = {
    get shortDescription() {
      return typeof config.short === "function" ? config.short() : config.short;
    },
    get longDescription() {
      return typeof config.long === "function" ? config.long() : config.long;
    },
    get usage() {
      return typeof config.use === "function" ? config.use() : config.use;
    },
    __args: true,
  };

  return zodProxy(z, argsProps) as Prettify<
    & ArgTypes
    & typeof argsProps
  >;
}

export function isArgs(schema: unknown): schema is Args {
  return (
    schema instanceof z.ZodType && "__args" in schema
  );
}

export function walkArgs(
  args: unknown,
  callback: (
    arg: z.ZodTypeAny,
    meta: { position: number; variadic: boolean },
  ) => void,
) {
  const hasArgs = isArgs(args);

  if (!hasArgs) {
    return;
  }

  const isOptional = args instanceof z.ZodDefault ||
    args instanceof z.ZodOptional;

  const argsItems = isOptional && args._def.innerType instanceof z.ZodTuple
    ? [...args._def.innerType.items, args._def.innerType._def.rest].filter(
      Boolean,
    )
    : args instanceof z.ZodTuple
    ? [...args.items, args._def.rest].filter(Boolean)
    : isOptional && args._def.innerType instanceof z.ZodArray
    ? [args._def.innerType._def.type]
    : args instanceof z.ZodArray
    ? [args._def.type]
    : [];

  if (argsItems.length) {
    for (let i = 0; i < argsItems.length; i++) {
      const item = argsItems[i];
      const variadic =
        !!(isOptional && args._def.innerType instanceof z.ZodTuple
          ? args._def.innerType._def.rest === item
          : args instanceof z.ZodTuple
          ? args._def.rest === item
          : isOptional && args._def.innerType instanceof z.ZodArray
          ? args._def.innerType
          : args instanceof z.ZodArray
          ? args
          : false);

      callback(item, { position: i, variadic });
    }
  }
}

export type Args =
  & ArgsZodTypes
  & {
    shortDescription?: string;
    longDescription?: string;
    usage?: string;
    __args: true;
  };

export type ArgsZodTypes =
  | z.ZodTuple
  | z.ZodArray<any>
  | z.ZodDefault<z.ZodTuple | z.ZodArray<any>>
  | z.ZodOptional<z.ZodTuple | z.ZodArray<any>>;

export type ArgsConfig = {
  short?: string | (() => string);
  long?: string | (() => string);
  use?: string | (() => string);
};

export type ArgTypes = Pick<typeof z, "tuple" | "array">;
export type inferArgs<T extends Args | ArgsZodTypes> = T extends
  z.ZodOptional<z.ZodTuple | z.ZodArray<any>> ? [] | NonNullable<T["_output"]>
  : T["_output"];
