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
      ? Rest extends [string]
        ? O[K[0]][Rest[0]]
        : Rest extends [string, ...string[]]
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

export type Merge<Destination, Source> = EnforceOptional<
  SimpleMerge<PickIndexSignature<Destination>, PickIndexSignature<Source>> &
    SimpleMerge<OmitIndexSignature<Destination>, OmitIndexSignature<Source>>
>;

type SimpleMerge<Destination, Source> = {
  [Key in keyof Destination | keyof Source]: Key extends keyof Source
    ? Source[Key]
    : Key extends keyof Destination
    ? Destination[Key]
    : never;
};

export type PickIndexSignature<ObjectType> = {
  [KeyType in keyof ObjectType as {} extends Record<KeyType, unknown>
    ? KeyType
    : never]: ObjectType[KeyType];
};
export type OmitIndexSignature<ObjectType> = {
  [KeyType in keyof ObjectType as {} extends Record<KeyType, unknown>
    ? never
    : KeyType]: ObjectType[KeyType];
};

// Returns `never` if the key is optional otherwise return the key type.
type RequiredFilter<Type, Key extends keyof Type> = undefined extends Type[Key]
  ? Type[Key] extends undefined
    ? Key
    : never
  : Key;

// Returns `never` if the key is required otherwise return the key type.
type OptionalFilter<Type, Key extends keyof Type> = undefined extends Type[Key]
  ? Type[Key] extends undefined
    ? never
    : Key
  : never;

export type EnforceOptional<ObjectType> = Prettify<
  {
    [Key in keyof ObjectType as RequiredFilter<
      ObjectType,
      Key
    >]: ObjectType[Key];
  } & {
    [Key in keyof ObjectType as OptionalFilter<ObjectType, Key>]?: Exclude<
      ObjectType[Key],
      undefined
    >;
  }
>;
