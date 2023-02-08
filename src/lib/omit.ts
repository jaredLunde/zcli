export function omit<
  Obj extends Record<string, unknown>,
  Keys extends Readonly<string>,
>(obj: Obj, keys: Keys[]): Omit<Obj, Keys> {
  // @ts-expect-error: we are better than TS
  return Object.fromEntries(
    // @ts-expect-error: we are better than TS
    Object.entries(obj).filter(([key]) => !keys.includes(key)),
  );
}
