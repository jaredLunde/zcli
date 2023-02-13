// deno-lint-ignore-file no-explicit-any
import { Arg } from "../args.ts";
import { Command } from "../command.ts";
import { Flag } from "../flags.ts";
import { z } from "../z.ts";

export function escapeString(str: string): string {
  return str.replace(notAlphaNumeric, "_");
}

const notAlphaNumeric = /[^\w]/g;

export type GenericCommand = Command<
  any,
  Arg<any, any>,
  Flag<any, any>,
  Flag<any, any>
>;
export type GenericArg = Arg<string, z.ZodTypeAny>;
export type GenericFlag = Flag<z.ZodTypeAny, string>;
