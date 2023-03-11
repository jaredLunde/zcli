// deno-lint-ignore-file no-explicit-any
import { BaseContext } from "./command.ts";
import { dedent } from "./lib/dedent.ts";
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
    short(context: any) {
      let description: string | undefined;

      if (typeof config.short === "function") {
        description = config.short(context);
      } else {
        description = config.short;
      }

      return description && [...dedent(description)].join(" ");
    },
    long(context: any) {
      let description: string | undefined;

      if (typeof config.long === "function") {
        description = config.long(context);
      } else {
        description = config.long;
      }

      return description && [...dedent(description)].join("\n");
    },
    usage(context: any) {
      let usage: string | undefined;

      if (typeof config.use === "function") {
        usage = config.use(context);
      } else {
        usage = config.use;
      }

      return usage;
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
    /**
     * A short description of the args.
     */
    short<Context extends BaseContext>(context: Context): string | undefined;
    /**
     * A long description of the args.
     */
    long<Context extends BaseContext>(context: Context): string | undefined;
    /**
     * A usage string for the arguments.
     */
    usage<Context extends BaseContext>(context: Context): string | undefined;
    __args: true;
  };

export type ArgsZodTypes =
  | z.ZodTuple<any, any>
  | z.ZodArray<any>
  | z.ZodDefault<z.ZodTuple<any, any> | z.ZodArray<any>>
  | z.ZodOptional<z.ZodTuple<any, any> | z.ZodArray<any>>;

export type ArgsConfig = {
  /**
   * A short description of the args.
   */
  short?: string | (<Context extends BaseContext>(context: Context) => string);
  /**
   * A long description of the args.
   */
  long?: string | (<Context extends BaseContext>(context: Context) => string);
  /**
   * A usage string for the arguments.
   */
  use?: string | (<Context extends BaseContext>(context: Context) => string);
};

export type ArgTypes = Pick<typeof z, "tuple" | "array">;
export type inferArgs<T extends Args | ArgsZodTypes> = T extends
  z.ZodOptional<z.ZodTuple<any, any> | z.ZodArray<any>>
  ? [] | NonNullable<T["_output"]>
  : T["_output"];
