// deno-lint-ignore-file no-explicit-any
import { JSONc, path, TOML, YAML } from "./deps.ts";
import { Join, NestedKeys, NestedValue, Split } from "./lib/types.ts";
import { z } from "./z.ts";

/**
 * Add a type-safe configuration file to your CLI context. This is
 * useful for storing things like user preferences.
 *
 * @param schema - The schema for the config.
 * @param options - Configuration options
 */
export function config<Schema extends z.ZodRawShape>(
  /**
   * The schema for the config.
   */
  schema: Schema,
  options: ConfigOptions<Schema>,
): Config<Schema> {
  const schemaObject = z.object(schema);
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
  let cached: z.infer<typeof schemaObject> | undefined;

  return {
    async set(key, value) {
      const config = await this.get();
      configUtil.set(config, key.split("."), value);
      await this.write(config);
    },

    async get(key?: any): Promise<any> {
      if (cached) return key ? configUtil.get(cached, key.split(".")) : cached;
      const config = await this.read();
      return key ? configUtil.get(config, key.split(".")) : config;
    },

    async delete(key) {
      const config = await this.get();
      const path = key.split(".");
      configUtil.delete(config, path);
      // Prevent knowingly failing validation
      if (configUtil.get(defaultConfig, path) !== undefined) {
        configUtil.set(config, path, configUtil.get(defaultConfig, path));
      }

      await this.write(config);
    },

    async clear() {
      await this.write(defaultConfig as any);
    },

    async write(config: z.infer<typeof schemaObject>) {
      try {
        Deno.statSync(configDir);
      } catch (_err) {
        await Deno.mkdir(configDir, { recursive: true });
      }

      config = await schemaObject.parseAsync(config);
      await Deno.writeTextFile(configPath, parser.stringify(config), {
        mode,
      });
      cached = config;
    },

    async read() {
      try {
        Deno.statSync(configPath);
      } catch (_err) {
        return schemaObject.parseAsync(defaultConfig);
      }

      try {
        const config = parser.parse(await Deno.readTextFile(configPath));
        return (cached = await schemaObject.parseAsync(config));
      } catch (_err) {
        const nextConfig = await schemaObject.parseAsync(defaultConfig);
        await this.write(nextConfig);
        return (cached = nextConfig);
      }
    },
  };
}

export const parsers = {
  jsonc: {
    stringify: (value: unknown) => JSON.stringify(value, null, 2),
    parse: JSONc.parse,
  },
  yaml: YAML,
  toml: TOML,
} as const;

export const configUtil = {
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

export type ConfigOptions<Schema extends z.ZodRawShape> = {
  /**
   * A default config to use if the config file doesn't exist.
   */
  defaultConfig: z.infer<z.ZodObject<Schema>>;
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
  Schema extends z.ZodRawShape,
  Inferred extends z.infer<z.ZodObject<any>> = z.infer<z.ZodObject<Schema>>,
> = {
  /**
   * Set a value in the config.
   *
   * @param key - The path to the value.
   * @param value - The value to set.
   */
  set<Key extends Join<NestedKeys<Inferred>>>(
    key: Key,
    value: NestedValue<Inferred, Split<Key>>,
  ): Promise<void>;
  /**
   * Get a value from the config.
   *
   * @param key - The path to the value.
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
   *
   * @param key - The path to the value.
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
