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
> = K extends [string, ...infer Rest]
  ? K[0] extends keyof O
    ? O[K[0]] extends Record<string, unknown>
      ? Rest extends [string, ...string[]]
        ? NestedValue<O[K[0]], Rest>
        : O[K[0]]
      : O[K[0]]
    : never
  : never;

export type Join<Strings extends Readonly<Array<string>>> = Strings extends []
  ? ""
  : Strings extends readonly [string]
  ? `${Strings[0]}`
  : Strings extends readonly [
      string,
      ...infer Rest extends ReadonlyArray<string>
    ]
  ? `${Strings[0]}.${Join<Rest>}`
  : string;

export type Split<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? [Head, ...Split<Tail>]
  : [S];
