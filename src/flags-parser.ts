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
export function parse<TDoubleDash extends boolean | undefined = undefined>(
  args: string[],
  { bools, numbers, negatable, collect, aliases }: Flags,
): Args<TDoubleDash> {
  const argv: Args = { _: [], _doubleDash: [] };

  function set(name: string, value: unknown) {
    let o = argv;
    let key = name;

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

    if (collect[name] === undefined) {
      o[key] = value;
    } else {
      (o[key] as unknown[]).push(value);
    }
  }

  for (const key in collect) {
    argv[key] = [];
  }

  // all args after "--" are not parsed
  if (args.indexOf("--") > -1) {
    argv["_doubleDash"] = args.slice(args.indexOf("--") + 1);
    args = args.slice(0, args.indexOf("--"));
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const short = arg[0] === "-";
    const long = arg[0] === "-" && arg[1] === "-";

    if (long) {
      const equalityArg = arg.match(equalityArgRegex);

      if (equalityArg) {
        let [, key, value] = equalityArg;
        key = aliases[key] ?? key;

        if (bools[key]) {
          const booleanValue = value !== "false";
          set(key, booleanValue);
        } else if (numbers[key]) {
          set(key, Number(value));
        } else {
          set(key, value);
        }

        continue;
      }

      if (
        negatableRegex.test(arg) &&
        negatable[arg.replace(negatableRegex, "")]
      ) {
        const key = arg.replace(negatableRegex, "");
        set(aliases[key] ?? key, false);
        continue;
      }

      const optionArg = arg.slice(2);

      if (optionArg) {
        let key = optionArg;
        key = aliases[key] ?? key;

        if (bools[key]) {
          set(key, true);
          continue;
        }

        const next = args[i + 1];

        if (next !== undefined && next[0] !== "-") {
          set(key, numbers[key] ? Number(next) : next);
          i++;
        } else if (next === "true" || next === "false") {
          set(key, next === "true");
          i++;
        } else {
          set(key, "");
        }

        continue;
      }
    }

    if (short && arg[1]) {
      const letters = arg.slice(1, -1);
      let broken = false;

      for (let j = 0; j < letters.length; j++) {
        const next = arg.slice(j + 2);
        let key = letters[j];
        key = aliases[key] ?? key;

        if (next === "-") {
          set(key, next);
          continue;
        }

        if (letterRegex.test(letters[j]) && equalsRegex.test(next)) {
          set(key, next.split(/=(.+)/)[1]);
          broken = true;
          break;
        }

        if (letterRegex.test(letters[j]) && shortFlagRegex.test(next)) {
          set(key, next);
          broken = true;
          break;
        }

        if (letters[j + 1] && letters[j + 1].match(nonAlnumRegex)) {
          set(key, arg.slice(j + 2));
          broken = true;
          break;
        }

        set(key, bools[key] ? true : "");
      }

      let [key] = arg.slice(-1);
      key = aliases[key] ?? key;

      if (!broken && key !== "-") {
        if (args[i + 1] && !bools[key] && !flagRegex.test(args[i + 1])) {
          if (numbers[key]) {
            set(key, Number(args[i + 1]));
          } else {
            set(key, args[i + 1]);
          }

          i++;
        } else if (args[i + 1] === "true" || args[i + 1] === "false") {
          set(key, args[i + 1] === "true");
          i++;
        } else {
          set(key, bools[key] ? true : "");
        }
      }

      continue;
    }

    argv._.push(arg);
  }

  // @ts-expect-error: it's fine
  return argv;
}

const equalityArgRegex = /^--([^=]+)=(.*)$/s;
const negatableRegex = /^--no-/;
const letterRegex = /[A-Za-z]/;
const equalsRegex = /=/;
const shortFlagRegex = /-?\d+(\.\d*)?(e-?\d+)?$/;
const flagRegex = /^(-|--)[^-]/;
const nonAlnumRegex = /\W/;

/** The value returned from `parse`. */
export type Args<TDoubleDash extends boolean | undefined = undefined> =
  Prettify<
    & Record<string, unknown>
    & {
      /** Contains all the arguments that didn't have an option associated with
       * them. */
      _: Array<string | number>;
    }
    & (boolean extends TDoubleDash ? DoubleDash
      : true extends TDoubleDash ? Required<DoubleDash>
      : Record<never, never>)
  >;

type DoubleDash = {
  /** Contains all the arguments that appear after the double dash: "--". */
  _doubleDash?: Array<string>;
};

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
