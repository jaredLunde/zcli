import { z } from "./z.ts";
import { colors } from "./fmt.ts";
import { table } from "./lib/simple-table.ts";
import { Prettify } from "./lib/types.ts";

export function env<EnvSchema extends z.ZodRawShape>(
  env?: EnvSchema,
): Prettify<Env<EnvSchema>> {
  const envSchema = env ? z.object(env) : undefined;

  return {
    get(key) {
      const schema = envSchema?.shape[key];

      if (!schema) {
        return Deno.env.get(key);
      }

      try {
        return schema.parse(Deno.env.get(key));
      } catch (err) {
        if (err instanceof z.ZodError) {
          throw new EnvError(err);
        }

        throw err;
      }
    },
    set(key, value) {
      Deno.env.set(key, value);
    },
    delete(key) {
      Deno.env.delete(key);
    },
    // @ts-expect-error: it's fine
    toObject() {
      if (envSchema) {
        try {
          return envSchema.parse(Deno.env.toObject());
        } catch (err) {
          if (err instanceof z.ZodError) {
            throw new EnvError(err);
          }

          throw err;
        }
      }

      return Deno.env.toObject();
    },
  };
}

env.bool = function boolean(message?: string) {
  return z
    .union([
      z.string({ invalid_type_error: message, required_error: message }),
      z.number({ invalid_type_error: message, required_error: message }),
    ])
    .transform((s, ctx) => {
      if (s === "true" || s == 1) return true;
      if (s === "false" || s == 0) return false;

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: message || "Invalid boolean.",
      });
    });
};

env.port = function port(
  message = "Invalid port. Must be an integer between 0 and 65536.",
) {
  return z
    .number({ invalid_type_error: message, required_error: message })
    .int(message)
    .min(0, message)
    .max(65536, message)
    .default(8080);
};

env.url = function number(message?: string) {
  return z.string().url(message);
};

env.json = function json<Schema extends z.ZodTypeAny>(
  schema: Schema,
  message?: string,
) {
  return z.string().transform((s, ctx): z.infer<Schema> => {
    try {
      return schema.parse(JSON.parse(s));
    } catch (_err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: message || "Invalid JSON.",
      });
    }
  });
};

export class EnvError extends Error {
  constructor(zodError: z.ZodError) {
    const issues: string[][] = zodError.issues.flatMap((issue) => {
      return [["•", colors.bold(issue.path.join(".")), issue.message]];
    });
    let issuesTable = "";

    for (const line of table(issues, { indent: 0, cellPadding: 1 })) {
      issuesTable += line + "\n";
    }

    super(`Invalid environment variables:\n${issuesTable}`);
    this.name = "EnvError";
  }
}

export type Env<EnvSchema extends z.ZodRawShape> = {
  get<Key extends Extract<keyof z.infer<z.ZodObject<EnvSchema>>, string>>(
    key: Key,
  ): z.infer<z.ZodObject<EnvSchema>>[Key];
  set(
    key: Extract<keyof z.infer<z.ZodObject<EnvSchema>>, string>,
    value: string,
  ): void;
  delete(key: Extract<keyof z.infer<z.ZodObject<EnvSchema>>, string>): void;
  toObject(): z.infer<z.ZodObject<EnvSchema>>;
};
