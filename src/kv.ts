// deno-lint-ignore-file no-explicit-any
import * as YAML from "https://deno.land/std@0.177.0/encoding/yaml.ts";
import * as TOML from "https://deno.land/std@0.177.0/encoding/toml.ts";
import * as JSONc from "https://deno.land/std@0.177.0/encoding/jsonc.ts";
import * as INI from "https://deno.land/x/ini@v2.1.0/mod.ts";
import * as path from "https://deno.land/std@0.177.0/path/mod.ts";
import { z } from "./z.ts";

/**
 * Add a type-safe key-value store to your CLI context. This is useful for
 * storing things like authentication tokens and other values that you want to
 * persist between CLI invocations.
 *
 * @param schema - The schema for the key-value store.
 * @param options - Configuration options
 */
export function kv<Schema extends z.ZodRawShape>(
  /**
   * The schema for the key-value store.
   */
  schema: Schema,
  options: KvOptions = {},
): Kv<Schema> {
  const execPath = Deno.execPath();
  const basename = path.basename(execPath, path.extname(execPath));
  const name = basename === "deno" ? "zcli-dev" : basename;
  const { path: userKvPath, format = "toml", mode = 0o600 } = options;
  const defaultKvPath = path.join(
    Deno.env.get("HOME")!,
    `.${name}`,
    `kv.${format}`,
  );
  const kvPath = userKvPath ?? defaultKvPath;
  const kvDir = path.dirname(kvPath);
  const parser = parsers[format];
  let cached:
    | Record<
      string,
      {
        value: unknown;
        expires: number;
      }
    >
    | undefined;

  async function write(kv: typeof cached = {}) {
    try {
      Deno.statSync(kvDir);
    } catch (_err) {
      await Deno.mkdir(kvDir, { recursive: true });
    }

    await Deno.writeTextFile(kvPath, parser.stringify(kv), {
      mode,
    });
    cached = kv;
  }

  async function read(): Promise<Exclude<typeof cached, undefined>> {
    try {
      Deno.statSync(kvPath);
    } catch (_err) {
      return {};
    }

    const kv = parser.parse(await Deno.readTextFile(kvPath));
    return (cached = kv);
  }

  async function get(key?: any): Promise<any> {
    async function _get(obj: any, key?: any) {
      const cachedValue = key ? obj[key] : obj;

      if (key && cachedValue && !isExpired(cachedValue as any)) {
        try {
          return await schema[key].parseAsync(cachedValue.value);
        } catch (_err) {
          return undefined;
        }
      } else if (!key) {
        return Object.fromEntries(
          (
            await Promise.all(
              Object.entries(
                cachedValue as Exclude<typeof cached, undefined>,
              ).filter(async ([key, val]) => {
                if (isExpired(val)) {
                  return false;
                }

                const parsedValue = await schema[key].safeParseAsync(val.value);
                return parsedValue.success;
              }),
            )
          ).map(([key, val]) => [key, val.value]),
        );
      }
    }

    if (cached) {
      return await _get(cached, key);
    }

    const kv = await read();
    return await _get(kv, key);
  }

  return {
    async set(key, value, ttl) {
      const kv = await get();

      kv[key] = {
        value: await schema[key].parseAsync(value),
        expires: ttl !== undefined ? Date.now() + ttl * 1000 : -1,
      };

      await write(kv);
    },
    get,
    async delete(key) {
      const kv = await get();
      delete kv[key];
      await write(kv);
    },
    async clear() {
      await write();
    },
  };
}

const parsers = {
  jsonc: {
    stringify: (value: unknown) => JSON.stringify(value, null, 2),
    parse: JSONc.parse,
  },
  yaml: YAML,
  toml: TOML,
  ini: INI,
} as const;

function isExpired({ expires }: { expires: number; value: unknown }): boolean {
  return expires !== -1 && Date.now() > expires;
}

export type KvOptions = {
  /**
   * The path to the key-value file.
   * @default "$HOME/.<name>/kv.<format>"
   */
  path?: string;
  /**
   * @default "toml"
   */
  format?: "jsonc" | "yaml" | "toml" | "ini";
  /**
   * The write mode for the kv file.
   * @default 0o600
   */
  mode?: number;
};

export type Kv<
  Schema extends z.ZodRawShape,
  Inferred extends z.infer<z.ZodObject<Schema>> = z.infer<z.ZodObject<Schema>>,
> = {
  /**
   * Set a value in the key-value store.
   *
   * @param key The key to set.
   * @param value The value to set.
   * @param ttl The time to live in seconds.
   */
  set<Key extends keyof Inferred>(
    key: Key,
    value: Inferred[Key],
    ttl?: number,
  ): Promise<void>;
  /**
   * Get a value from the key-value-store.
   *
   * @param key The key to get.
   */
  get<Key extends keyof Inferred>(key: Key): Promise<Inferred[Key]>;
  /**
   * Get the entire kv.
   */
  get(): Promise<Inferred>;
  /**
   * Delete a value from the key-value store.
   *
   * @param key The key to delete.
   */
  delete<Key extends keyof Inferred>(key: Key): Promise<void>;
  /**
   * Clear the entire kev-value store.
   */
  clear(): Promise<void>;
};
