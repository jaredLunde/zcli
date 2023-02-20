// deno-lint-ignore-file no-explicit-any
import { Command } from "../command.ts";

export function escapeString(str: string): string {
  return str.replace(notAlphaNumeric, "_");
}

const notAlphaNumeric = /[^\w]/g;

export type GenericCommand = Command<any, any, any, any>;
