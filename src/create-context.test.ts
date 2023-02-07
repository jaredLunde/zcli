import {
  assertEquals,
  assertExists,
  assertThrows,
} from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.176.0/testing/bdd.ts";
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";

import { createContext } from "./create-context.ts";

describe("createContext()", () => {
  describe("env", () => {
    it("should be optional", () => {
      const { env } = createContext({
        env: z.object({
          PORT: z
            .string()
            .transform((v) => parseInt(v, 10))
            .optional(),
        }),
      });

      assertEquals(env.get("PORT"), undefined);
    });

    it("should not be optional", () => {
      const { env } = createContext({
        env: z.object({
          PORT: z.string().transform((v) => parseInt(v, 10)),
        }),
      });

      assertThrows(() => env.get("PORT"));

      env.set("PORT", "8080");
      assertEquals(env.get("PORT"), 8080);

      env.delete("PORT");
      assertThrows(() => env.get("PORT"));
    });

    it("should return a parsed object", () => {
      const { env } = createContext({
        env: z.object({
          PORT: z.string().transform((v) => parseInt(v, 10)),
        }),
      });

      env.set("PORT", "8080");
      assertEquals(env.toObject(), { PORT: 8080 });
    });

    it('should work without an "env" schema', () => {
      const { env } = createContext({});
      assertExists(env.toObject().HOME);
      assertExists(env.get("HOME"));
    });
  });
});
