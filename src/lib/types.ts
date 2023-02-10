// deno-lint-ignore-file ban-types
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type NestedKeys<TObject> = TObject extends Record<string, unknown>
  ? {
      [TKey in keyof TObject]:
        | readonly [TKey]
        | readonly [TKey, ...NestedKeys<TObject[TKey]>];
    }[keyof TObject]
  : never;

/** Extract values of object having a specified path */
export type NestedValue<
  O extends Record<string, unknown>,
  K extends readonly string[]
> = K extends [infer P, ...infer Rest]
  ? P extends keyof O
    ? O[P] extends Record<string, unknown>
      ? Rest extends [string, ...string[]]
        ? NestedValue<O[P], Rest>
        : O[P]
      : O[P]
    : never
  : never;

export type Join<
  Strings extends Readonly<Array<string>>,
  Delimiter extends string = ""
> = Strings extends []
  ? ""
  : Strings extends readonly [string]
  ? `${Strings[0]}`
  : Strings extends readonly [string, ...infer Rest extends Array<string>]
  ? `${Strings[0]}.${Join<Rest>}`
  : string;

export type Split<
  S extends string,
  Delimiter extends string = "."
> = S extends `${infer Head}${Delimiter}${infer Tail}`
  ? [Head, ...Split<Tail, Delimiter>]
  : S extends Delimiter
  ? []
  : [S];
