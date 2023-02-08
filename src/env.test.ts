import {
  assertEquals,
  assertExists,
  assertThrows,
} from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.176.0/testing/bdd.ts";
import { z } from "./z.ts";

import { env } from "./env.ts";

describe("env()", () => {
  describe("env", () => {
    it("should be optional", () => {
      const e = env({
        PORT: z
          .string()
          .transform((v) => parseInt(v, 10))
          .optional(),
      });

      assertEquals(e.get("PORT"), undefined);
    });

    it("should not be optional", () => {
      const e = env({
        PORT: z.string().transform((v) => parseInt(v, 10)),
      });

      assertThrows(() => e.get("PORT"));

      e.set("PORT", "8080");
      assertEquals(e.get("PORT"), 8080);

      e.delete("PORT");
      assertThrows(() => e.get("PORT"));
    });

    it("should return a parsed object", () => {
      const e = env({
        PORT: z.string().transform((v) => parseInt(v, 10)),
      });

      e.set("PORT", "8080");
      assertEquals(e.toObject(), { PORT: 8080 });
    });

    it('should work without an "env" schema', () => {
      const e = env();
      assertExists(e.toObject().HOME);
      assertExists(e.get("HOME"));
    });
  });
});
