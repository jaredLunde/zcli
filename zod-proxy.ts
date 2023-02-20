// deno-lint-ignore-file no-explicit-any
export function zodProxy(z: any, props: any) {
  const proxy = new Proxy(z, {
    get(target, prop) {
      let original = target[prop];

      if (
        typeof original === "function" &&
        typeof prop === "string" &&
        lowercaseLetters.indexOf(prop[0]) !== -1 &&
        !original._isProxy &&
        ignoreProperties.indexOf(prop) === -1
      ) {
        original = original.bind(proxy);
        return (...args: any[]) => {
          const result = original(...args);

          if (
            result &&
            typeof result === "object" &&
            typeof result.constructor === "function" &&
            result.constructor.name.startsWith("Zod") &&
            !result._isProxy
          ) {
            return zodProxy(
              Object.assign(result, props),
              props,
            );
          }

          return result;
        };
      }

      return original;
    },
  });

  return proxy;
}

const lowercaseLetters = "abcdefghijklmnopqrstuvwxyz";
const ignoreProperties = [
  "bind",
  "parse",
  "parseAsync",
  "safeParse",
  "safeParseAsync",
  "then",
];
