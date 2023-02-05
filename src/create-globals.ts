// deno-lint-ignore-file no-explicit-any
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import { Opt } from "./opt.ts";

export function createGlobals<
  Env extends z.ZodObject<any>,
  Opts extends Readonly<Opt<any, any, any, any, any, any>>
>({
  opt,
  env,
}: {
  env?: Env;
  opt?: ReadonlyArray<Opts>;
} = {}): Globals<Env> {
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

export type Globals<
  Env extends z.ZodObject<any>
  // Opt extends Readonly<ReturnType<typeof opt>>
> = {
  // opt: Opt extends undefined ? undefined : ReadonlyArray<Opt>;
  env: {
    get<Key extends Extract<keyof z.infer<Env>, string>>(
      key: Key
    ): z.infer<Env>[Key];
    set(key: Extract<keyof z.infer<Env>, string>, value: string): void;
    delete(key: Extract<keyof z.infer<Env>, string>): void;
    toObject(): z.infer<Env>;
  };
};
