// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This has been modified to suit the needs of this project.
import { Prettify } from "./lib/types.ts";

/** Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default, any arguments starting with `-` or `--` are considered boolean
 *  If the argument name is followed by an equal sign (`=`) it is
 * considered a key-value pair. Any arguments which could not be parsed are
 * available in the `_` property of the returned object.
 *
 * Any arguments after `'--'` will not be parsed and will end up in `parsedArgs._`.
 */
export function parse(
  args: string[],
  { bools, numbers, negatable, collect, aliases }: Flags,
): Args {
  const argv: Args = { _: [], _doubleDash: [] };

  function set(name: string, value: unknown) {
    let o = argv;
    let key = aliases[name] ?? name;

    if (bools[name]) {
      value = value !== falseStr;
    } else if (numbers[name]) {
      value = Number(value);
    }

    if (name.indexOf(".") !== -1) {
      const keys = name.split(".");

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        if (o[key] === undefined) {
          o[key] = {};
        }
        // @ts-expect-error: all good champ
        o = o[key];
      }

      key = keys[keys.length - 1];
    }

    if (collect[key] === undefined) {
      o[key] = value;
    } else {
      if (o[key] === undefined) {
        o[key] = [value];
      } else {
        (o[key] as unknown[]).push(value);
      }
    }
  }

  // all args after "--" are not parsed
  if (args.indexOf("--") > -1) {
    argv["_doubleDash"] = args.slice(args.indexOf("--") + 1);
    args = args.slice(0, args.indexOf("--"));
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const firstChar = arg[0];
    const secondChar = arg[1];
    const short = firstChar === "-";
    const long = firstChar === "-" && secondChar === "-";

    if (long) {
      const value = arg.indexOf("=") > -1 && arg.match(equalityArgRegex)?.[1];
      const key = arg.slice(2, value ? -value!.length - 1 : undefined);

      if (value) {
        set(key, value);
        continue;
      }

      if (key.slice(0, 3) === "no-") {
        const k = key.slice(3);

        if (negatable[k]) {
          set(k, falseStr);
          continue;
        }
      }

      const next = args[i + 1];

      if (next && !flagRegex.test(next)) {
        set(key, next);
        i++;
        continue;
      }

      set(key, "");
      continue;
    }

    if (short && secondChar) {
      const letters = arg.slice(1, -1);
      let broken = false;

      for (let j = 0; j < letters.length; j++) {
        const next = arg.slice(j + 2);
        const key = letters[j];

        if (next === "-") {
          set(key, next);
          continue;
        }

        if (LETTERS.indexOf(letters[j]) !== -1) {
          if (equalsRegex.test(next)) {
            const value = next.split(/=(.+)/)[1];
            set(key, value);
            broken = true;
            break;
          }

          if (shortNumRegex.test(next)) {
            set(key, next);
            broken = true;
            break;
          }
        }

        if (letters[j + 1] && nonAlnumRegex.test(letters[j + 1])) {
          const value = arg.slice(j + 2);
          set(key, value);
          broken = true;
          break;
        }

        set(key, "");
        continue;
      }

      const key = arg[arg.length - 1];
      const value = args[i + 1];

      if (!broken && key !== "-") {
        if (value && !flagRegex.test(value)) {
          set(key, value);
          i++;
        } else {
          set(key, "");
        }
      }
    } else {
      argv._.push(arg);
    }
  }

  return argv;
}

const equalityArgRegex = /^--[^=]+=(.*)/;
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const equalsRegex = /=/;
const shortNumRegex = /^-?\d+(\.\d*)?(e-?\d+)?$/;
const flagRegex = /^(-)[-]?[^\d]/;
const nonAlnumRegex = /\W/;
const falseStr = "false";

/** The value returned from `parse`. */
export type Args<TDoubleDash extends boolean | undefined = undefined> =
  Prettify<
    Record<string, unknown> & {
      /** Contains all the arguments that didn't have an option associated with
       * them. */
      _: Array<string | number>;

      /** Contains all the arguments that appear after the double dash: "--". */
      _doubleDash?: Array<string>;
    }
  >;

/** The options for the `parse` call. */
export interface ParseOptions<
  TDoubleDash extends boolean | undefined = boolean | undefined,
> {
  /**
   * An object mapping string names to strings or arrays of string argument
   * names to use as aliases.
   */
  alias?: Record<string, readonly string[]>;

  /**
   * A boolean, string or array of strings to always treat as booleans. If
   * `true` will treat all double hyphenated arguments without equal signs as
   * `boolean` (e.g. affects `--foo`, not `-f` or `--foo=bar`).
   *  All `boolean` arguments will be set to `false` by default.
   */
  boolean?: string[];

  /** A string or array of strings argument names to always treat as strings. */
  numbers?: string[];

  /**
   * A string or array of strings argument names to always treat as arrays.
   * Collectable options can be used multiple times. All values will be
   * collected into one array. If a non-collectable option is used multiple
   * times, the last value is used.
   * All Collectable arguments will be set to `[]` by default.
   */
  collect?: string[];

  /**
   * A string or array of strings argument names which can be negated
   * by prefixing them with `--no-`, like `--no-config`.
   */
  negatable?: string[];
}

interface Flags {
  bools: Record<string, boolean>;
  numbers: Record<string, boolean>;
  collect: Record<string, boolean>;
  negatable: Record<string, boolean>;
  aliases: Record<string, string>;
}

interface NestedMapping {
  [key: string]: NestedMapping | unknown;
}
