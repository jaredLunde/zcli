// deno-lint-ignore-file ban-types
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
