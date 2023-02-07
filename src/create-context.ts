// deno-lint-ignore-file no-explicit-any
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";

export function createContext<Env extends z.ZodObject<any>>({
  env,
}: {
  env?: Env;
} = {}): Context<Env> {
  return {
    env: {
      get(key) {
        const schema = env?.shape[key];

        if (!schema) {
          return Deno.env.get(key);
        }

        return schema.parse(Deno.env.get(key));
      },
      set(key, value) {
        Deno.env.set(key, value);
      },
      delete(key) {
        Deno.env.delete(key);
      },
      toObject() {
        if (env) {
          return env.parse(Deno.env.toObject());
        }

        return Deno.env.toObject();
      },
    },
  };
}

export type Context<Env extends z.ZodObject<any>> = {
  env: {
    get<Key extends Extract<keyof z.infer<Env>, string>>(
      key: Key
    ): z.infer<Env>[Key];
    set(key: Extract<keyof z.infer<Env>, string>, value: string): void;
    delete(key: Extract<keyof z.infer<Env>, string>): void;
    toObject(): z.infer<Env>;
  };
};
