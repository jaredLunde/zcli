// deno-lint-ignore-file no-explicit-any
import * as YAML from "https://deno.land/std@0.177.0/encoding/yaml.ts";
import * as TOML from "https://deno.land/std@0.177.0/encoding/toml.ts";
import * as JSONc from "https://deno.land/std@0.177.0/encoding/jsonc.ts";
import * as path from "https://deno.land/std@0.177.0/path/mod.ts";
import { Join, NestedKeys, NestedValue, Split } from "./lib/types.ts";
import { z } from "./z.ts";

const parsers = {
  jsonc: {
    stringify: (value: unknown) => JSON.stringify(value, null, 2),
    parse: JSONc.parse,
  },
  yaml: YAML,
  toml: TOML,
} as const;

export function config<Schema extends z.ZodObject<any>>(
  /**
   * The schema for the config.
   */
  schema: Schema,
  options: ConfigOptions<Schema>,
): Config<Schema> {
  const execPath = Deno.execPath();
  const basename = path.basename(execPath, path.extname(execPath));
  const name = basename === "deno" ? "zcli-dev" : basename;
  const {
    path: userConfigPath,
    format = "toml",
    mode = 0o600,
    defaultConfig = {},
  } = options;

  const defaultConfigPath = path.join(
    Deno.env.get("HOME")!,
    `.${name}`,
    `config.${format}`,
  );
  const configPath = userConfigPath ?? defaultConfigPath;
  const configDir = path.dirname(configPath);
  const parser = parsers[format];
  let cached: z.infer<Schema> | undefined;

  async function write(config: z.infer<Schema>) {
    try {
      Deno.statSync(configDir);
    } catch (_err) {
      await Deno.mkdir(configDir, { recursive: true });
    }

    config = await schema.parseAsync(config);
    await Deno.writeTextFile(configPath, parser.stringify(config), {
      mode,
    });
    cached = config;
  }

  async function read() {
    try {
      Deno.statSync(configPath);
    } catch (_err) {
      return await schema.parseAsync(defaultConfig);
    }

    try {
      const config = parser.parse(await Deno.readTextFile(configPath));
      return (cached = await schema.parseAsync(config));
    } catch (_err) {
      const nextConfig = await schema.parseAsync(defaultConfig);
      await write(nextConfig);
      return (cached = nextConfig);
    }
  }

  async function get(key?: any): Promise<any> {
    if (cached) return key ? configPaths.get(cached, key.split(".")) : cached;
    const config = await read();
    return key ? configPaths.get(config, key.split(".")) : config;
  }

  return {
    async set(key, value) {
      const config = await get();
      configPaths.set(config, key.split("."), value);
      await write(config);
    },
    get,
    async delete(key) {
      const config = await get();
      const path = key.split(".");
      configPaths.delete(config, path);
      // Prevent knowingly failing validation
      if (configPaths.get(defaultConfig, path) !== undefined) {
        configPaths.set(config, path, configPaths.get(defaultConfig, path));
      }

      await write(config);
    },
    async clear() {
      await write(defaultConfig);
    },
    write,
    read,
  };
}

export const configPaths = {
  /**
   * Recursively set a value on an object using a path.
   *
   * @param target - The object to set the value on.
   * @param paths - The path to the value.
   * @param value - The value to set.
   */
  set(target: any, paths: readonly string[] | string[], value: unknown): void {
    if (paths.length === 1) {
      target[paths[0]] = value;
      return target;
    }

    let next = target;

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (i === paths.length - 1) {
        next[path] = value;
      } else {
        const current = next[path];
        next = next[path] = current ?? (isNaN(paths[i + 1] as any) ? {} : []);
      }
    }
  },
  /**
   * Recursively get a value from an object using a path.
   *
   * @param target - The object to get the value from.
   * @param paths - The path to the value.
   */
  get<Returns>(target: any, paths: readonly string[] | string[]): Returns {
    let next = target;

    for (const path of paths) {
      next = next[path];
      if (next == null) {
        return next;
      }
    }

    return next;
  },
  /**
   * Delete a deep property from an object.
   *
   * @param target - The object to delete the property from.
   * @param paths - The path to the property.
   */
  delete(target: any, paths: readonly string[] | string[]): void {
    if (paths.length === 1) {
      delete target[paths[0]];
      return;
    }

    let next = target;

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (i === paths.length - 1) {
        delete next[path];
      } else {
        next = next[path];
      }
    }
  },
};

export type ConfigOptions<Schema extends z.ZodObject<any>> = {
  /**
   * A default config to use if the config file doesn't exist.
   */
  defaultConfig: z.infer<Schema>;
  /**
   * The path to the config file.
   * @default "$HOME/.<name>/config.<format>"
   */
  path?: string;
  /**
   * @default "toml"
   */
  format?: "jsonc" | "yaml" | "toml";
  /**
   * The write mode for the config file.
   * @default 0o600
   */
  mode?: number;
};

export type Config<
  Schema extends z.ZodObject<any>,
  Inferred extends z.infer<Schema> = z.infer<Schema>,
> = {
  /**
   * Set a value in the config.
   */
  set<Key extends Join<NestedKeys<Inferred>>>(
    key: Key,
    value: NestedValue<Inferred, Split<Key>>,
  ): Promise<void>;
  /**
   * Get a value from the config.
   */
  get<Keys extends Join<NestedKeys<Inferred>>>(
    key: Keys,
  ): Promise<NestedValue<Inferred, Split<Keys>>>;
  /**
   * Get the entire config.
   */
  get(): Promise<Inferred>;
  /**
   * Delete a value from the config.
   */
  delete<Key extends Join<NestedKeys<Inferred>>>(key: Key): Promise<void>;
  /**
   * Clear the entire config and reset it to its default values.
   */
  clear(): Promise<void>;
  /**
   * Write a new config to disk.
   */
  write(config: Inferred): Promise<void>;
  /**
   * Read the config from disk.
   * @returns The config.
   */
  read(): Promise<Inferred>;
};
