// deno-lint-ignore-file no-explicit-any
// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This has been modified to suit the needs of this project.
import { Prettify } from "./lib/types.ts";

/** Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default, any arguments starting with `-` or `--` are considered boolean
 * flags. If the argument name is followed by an equal sign (`=`) it is
 * considered a key-value pair. Any arguments which could not be parsed are
 * available in the `_` property of the returned object.
 *
 * By default, the flags module tries to determine the type of all arguments
 * automatically and the return type of the `parse` method will have an index
 * signature with `any` as value (`{ [x: string]: any }`).
 *
 * If the `string`, `boolean` or `collect` option is set, the return value of
 * the `parse` method will be fully typed and the index signature of the return
 * type will change to `{ [x: string]: unknown }`.
 *
 * Any arguments after `'--'` will not be parsed and will end up in `parsedArgs._`.
 *
 * Numeric-looking arguments will be returned as numbers unless `options.string`
 * or `options.boolean` is set for that argument name.
 *
 * @example
 * ```ts
 * import { parse } from "https://deno.land/std@$STD_VERSION/flags/mod.ts";
 * const parsedArgs = parse(Deno.args);
 * ```
 *
 * @example
 * ```ts
 * import { parse } from "https://deno.land/std@$STD_VERSION/flags/mod.ts";
 * const parsedArgs = parse(["--foo", "--bar=baz", "./quux.txt"]);
 * // parsedArgs: { foo: true, bar: "baz", _: ["./quux.txt"] }
 * ```
 */
export function parse<
  TDoubleDash extends boolean | undefined = undefined,
  TBooleans extends BooleanType = undefined,
  TNumbers extends StringType = undefined,
  TCollectable extends Collectable = undefined,
  TNegatable extends Negatable = undefined,
  TAliases extends Aliases<TAliasArgNames, TAliasNames> | undefined = undefined,
  TAliasArgNames extends string = string,
  TAliasNames extends string = string
>(
  args: string[],
  {
    "--": doubleDash = false,
    alias = {} as NonNullable<TAliases>,
    boolean = false,
    numbers = [],
    collect = [],
    negatable = [],
  }: ParseOptions<
    TBooleans,
    TNumbers,
    TCollectable,
    TNegatable,
    TAliases,
    TDoubleDash
  > = {}
): Args<TDoubleDash> {
  const aliases: Record<string, string[]> = {};
  const flags: Flags = {
    bools: {},
    numbers: {},
    allBools: false,
    collect: {},
    negatable: {},
  };

  if (alias !== undefined) {
    for (const key in alias) {
      const val = getForce(alias, key);
      if (typeof val === "string") {
        aliases[key] = [val];
      } else {
        aliases[key] = val as Array<string>;
      }

      const force = getForce(aliases, key);

      for (let i = 0; i < force.length; i++) {
        const alias = force[i];
        aliases[alias] = [key].concat(aliases[key].filter((y) => alias !== y));
      }
    }
  }

  if (boolean !== undefined) {
    if (typeof boolean === "boolean") {
      flags.allBools = !!boolean;
    } else {
      const booleanArgs: ReadonlyArray<string> =
        typeof boolean === "string" ? [boolean] : boolean;

      const bargs = booleanArgs.filter(Boolean);

      for (let i = 0; i < bargs.length; i++) {
        flags.bools[bargs[i]] = true;
        const alias = aliases[bargs[i]];

        if (alias) {
          for (let i = 0; i < alias.length; i++) {
            flags.bools[alias[i]] = true;
          }
        }
      }
    }
  }

  if (numbers !== undefined) {
    const numberArgs: ReadonlyArray<string> =
      typeof numbers === "string" ? [numbers] : numbers;

    const stargs = numberArgs.filter(Boolean);
    for (let i = 0; i < stargs.length; i++) {
      const key = stargs[i];
      flags.numbers[key] = true;
      const alias = aliases[key];

      if (alias) {
        for (let i = 0; i < alias.length; i++) {
          flags.numbers[alias[i]] = true;
        }
      }
    }
  }

  if (collect !== undefined) {
    const collectArgs: ReadonlyArray<string> =
      typeof collect === "string" ? [collect] : collect;

    const cargs = collectArgs.filter(Boolean);

    for (let i = 0; i < cargs.length; i++) {
      const key = cargs[i];
      flags.collect[key] = true;
      const alias = aliases[key];

      if (alias) {
        for (let i = 0; i < alias.length; i++) {
          flags.collect[alias[i]] = true;
        }
      }
    }
  }

  if (negatable !== undefined) {
    const negatableArgs: ReadonlyArray<string> =
      typeof negatable === "string" ? [negatable] : negatable;

    const nargs = negatableArgs.filter(Boolean);

    for (let i = 0; i < nargs.length; i++) {
      const key = nargs[i];
      flags.negatable[key] = true;
      const alias = aliases[key];

      if (alias) {
        for (let i = 0; i < alias.length; i++) {
          flags.negatable[alias[i]] = true;
        }
      }
    }
  }

  const argv: Args = { _: [] };

  function setKey(
    obj: NestedMapping,
    name: string,
    value: unknown,
    collect = true
  ) {
    let o = obj;
    const keys = name.split(".");

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (o[key] === undefined) {
        o[key] = {};
      }

      o = o[key] as NestedMapping;
    }

    const key = keys[keys.length - 1];
    const collectable = collect && !!flags.collect[name];

    if (!collectable) {
      o[key] = value;
    } else if (o[key] === undefined) {
      o[key] = [value];
    } else if (Array.isArray(o[key])) {
      (o[key] as unknown[]).push(value);
    } else {
      o[key] = [o[key], value];
    }
  }

  function setArg(key: string, value: unknown, collect?: boolean) {
    const a = aliases[key];

    if ((alias as any)[key] && a) {
      setKey(argv, key, value, collect);
    } else if (a) {
      for (let i = 0; i < a.length; i++) {
        if ((alias as any)[a[i]]) {
          setKey(argv, a[i], value, collect);
        }
      }
    } else {
      setKey(argv, key, value, collect);
    }
  }

  function aliasIsBoolean(key: string): boolean {
    return getForce(aliases, key).some(
      (x) => typeof flags.bools[x] === "boolean"
    );
  }

  let notFlags: string[] = [];

  // all args after "--" are not parsed
  if (args.includes("--")) {
    notFlags = args.slice(args.indexOf("--") + 1);
    args = args.slice(0, args.indexOf("--"));
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (/^--.+=/.test(arg)) {
      const m = arg.match(/^--([^=]+)=(.*)$/s);
      assert(m != null);
      const [, key, value] = m;

      if (flags.bools[key]) {
        const booleanValue = value !== "false";
        setArg(key, booleanValue);
      } else if (flags.numbers[key]) {
        setArg(key, Number(value));
      } else {
        setArg(key, value);
      }
    } else if (
      /^--no-.+/.test(arg) &&
      flags.negatable[arg.replace(/^--no-/, "")]
    ) {
      const m = arg.match(/^--no-(.+)/);
      assert(m != null);
      setArg(m[1], false);
    } else if (/^--.+/.test(arg)) {
      const m = arg.match(/^--(.+)/);
      assert(m != null);
      const [, key] = m;
      const next = args[i + 1];

      if (
        next !== undefined &&
        !/^-/.test(next) &&
        !flags.bools[key] &&
        !flags.allBools &&
        (aliases[key] ? !aliasIsBoolean(key) : true)
      ) {
        if (flags.numbers[key]) {
          setArg(key, Number(next));
        } else {
          setArg(key, next);
        }
        i++;
      } else if (/^(true|false)$/.test(next)) {
        setArg(key, next === "true");
        i++;
      } else {
        setArg(key, flags.bools[key] ? true : "");
      }
    } else if (/^-[^-]+/.test(arg)) {
      const letters = arg.slice(1, -1).split("");

      let broken = false;
      for (let j = 0; j < letters.length; j++) {
        const next = arg.slice(j + 2);

        if (next === "-") {
          setArg(letters[j], next);
          continue;
        }

        if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
          setArg(letters[j], next.split(/=(.+)/)[1]);
          broken = true;
          break;
        }

        if (
          /[A-Za-z]/.test(letters[j]) &&
          /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)
        ) {
          setArg(letters[j], next);
          broken = true;
          break;
        }

        if (letters[j + 1] && letters[j + 1].match(/\W/)) {
          setArg(letters[j], arg.slice(j + 2));
          broken = true;
          break;
        } else {
          setArg(letters[j], flags.bools[letters[j]] ? true : "");
        }
      }

      const [key] = arg.slice(-1);

      if (!broken && key !== "-") {
        if (
          args[i + 1] &&
          !/^(-|--)[^-]/.test(args[i + 1]) &&
          !flags.bools[key] &&
          (aliases[key] ? !aliasIsBoolean(key) : true)
        ) {
          if (flags.numbers[key]) {
            setArg(key, Number(args[i + 1]));
          } else {
            setArg(key, args[i + 1]);
          }

          i++;
        } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
          setArg(key, args[i + 1] === "true");
          i++;
        } else {
          setArg(key, flags.bools[key] ? true : "");
        }
      }
    } else {
      argv._.push(arg);
    }
  }

  for (const key in flags.collect) {
    if (!hasKey(argv, key.split(".")) && flags.collect[key]) {
      setKey(argv, key, [], false);
    }
  }

  if (doubleDash) {
    argv["--"] = [];
    for (let i = 0; i < notFlags.length; i++) {
      (argv as any)["--"].push(notFlags[i]);
    }
  } else {
    for (let i = 0; i < notFlags.length; i++) {
      argv._.push(notFlags[i]);
    }
  }

  return argv as Args<TDoubleDash>;
}

function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new Error(msg);
  }
}

function getForce<TValue>(obj: Record<string, TValue>, key: string): TValue {
  const v = obj[key];
  assert(v != null);
  return v;
}

function hasKey(obj: NestedMapping, keys: string[]): boolean {
  let o = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    o = (o[key] ?? {}) as NestedMapping;
  }

  const key = keys[keys.length - 1];
  return key in o;
}

/** Converts a union type `A | B | C` into an intersection type `A & B & C`. */
type UnionToIntersection<TValue> = (
  TValue extends unknown ? (args: TValue) => unknown : never
) extends (args: infer R) => unknown
  ? R extends Record<string, unknown>
    ? R
    : never
  : never;

type BooleanType = boolean | string | undefined;
type StringType = string | undefined;
type NumberType = number | undefined;
type ArgType = StringType | BooleanType | NumberType;

type Collectable = string | undefined;
type Negatable = string | undefined;

type Aliases<TArgNames = string, TAliasNames extends string = string> = Partial<
  Record<Extract<TArgNames, string>, TAliasNames | ReadonlyArray<TAliasNames>>
>;

/** The value returned from `parse`. */
export type Args<TDoubleDash extends boolean | undefined = undefined> =
  Prettify<
    Record<string, unknown> & {
      /** Contains all the arguments that didn't have an option associated with
       * them. */
      _: Array<string | number>;
    } & (boolean extends TDoubleDash
        ? DoubleDash
        : true extends TDoubleDash
        ? Required<DoubleDash>
        : Record<never, never>)
  >;

type DoubleDash = {
  /** Contains all the arguments that appear after the double dash: "--". */
  "--"?: Array<string>;
};

/** The options for the `parse` call. */
export interface ParseOptions<
  TBooleans extends BooleanType = BooleanType,
  TNumbers extends StringType = StringType,
  TCollectable extends Collectable = Collectable,
  TNegatable extends Negatable = Negatable,
  TAliases extends Aliases | undefined = Aliases | undefined,
  TDoubleDash extends boolean | undefined = boolean | undefined
> {
  /**
   * When `true`, populate the result `_` with everything before the `--` and
   * the result `['--']` with everything after the `--`.
   *
   * @default {false}
   *
   *  @example
   * ```ts
   * // $ deno run example.ts -- a arg1
   * import { parse } from "https://deno.land/std@$STD_VERSION/flags/mod.ts";
   * console.dir(parse(Deno.args, { "--": false }));
   * // output: { _: [ "a", "arg1" ] }
   * console.dir(parse(Deno.args, { "--": true }));
   * // output: { _: [], --: [ "a", "arg1" ] }
   * ```
   */
  "--"?: TDoubleDash;

  /**
   * An object mapping string names to strings or arrays of string argument
   * names to use as aliases.
   */
  alias?: TAliases;

  /**
   * A boolean, string or array of strings to always treat as booleans. If
   * `true` will treat all double hyphenated arguments without equal signs as
   * `boolean` (e.g. affects `--foo`, not `-f` or `--foo=bar`).
   *  All `boolean` arguments will be set to `false` by default.
   */
  boolean?: TBooleans | ReadonlyArray<Extract<TBooleans, string>>;

  /** A string or array of strings argument names to always treat as strings. */
  numbers?: TNumbers | ReadonlyArray<Extract<TNumbers, string>>;

  /**
   * A string or array of strings argument names to always treat as arrays.
   * Collectable options can be used multiple times. All values will be
   * collected into one array. If a non-collectable option is used multiple
   * times, the last value is used.
   * All Collectable arguments will be set to `[]` by default.
   */
  collect?: TCollectable | ReadonlyArray<Extract<TCollectable, string>>;

  /**
   * A string or array of strings argument names which can be negated
   * by prefixing them with `--no-`, like `--no-config`.
   */
  negatable?: TNegatable | ReadonlyArray<Extract<TNegatable, string>>;
}

interface Flags {
  bools: Record<string, boolean>;
  numbers: Record<string, boolean>;
  collect: Record<string, boolean>;
  negatable: Record<string, boolean>;
  allBools: boolean;
}

interface NestedMapping {
  [key: string]: NestedMapping | unknown;
}
