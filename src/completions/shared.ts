// deno-lint-ignore-file no-explicit-any
import { Arg } from "../args.ts";
import { Command } from "../command.ts";
import { Flag } from "../flags.ts";
import { z } from "../z.ts";

export function replaceSpecialChars(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

export type GenericCmd = Command<
  any,
  Arg<any, any>,
  Flag<any, any>,
  Flag<any, any>
>;
export type GenericArg = Arg<string, z.ZodTypeAny>;
export type GenericOpt = Flag<z.ZodTypeAny, string>;
