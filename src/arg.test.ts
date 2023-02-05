import {
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.176.0/testing/bdd.ts";
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";

import { arg } from "./arg.ts";

describe("arg()", () => {
  it("should be optional", () => {
    const { optional } = arg({
      name: "port",
      schema: z
        .string()
        .transform((v) => parseInt(v, 10))
        .optional(),
    });

    assertEquals(optional, true);
  });

  it("should not be optional", () => {
    const { optional } = arg({
      name: "port",
      schema: z.string().transform((v) => parseInt(v, 10)),
    });

    assertFalse(optional);
  });

  it("should be variadic", () => {
    const { variadic } = arg({
      name: "port",
      schema: z
        .string()
        .transform((v) => parseInt(v, 10))
        .array(),
    });

    assertEquals(variadic, true);
  });

  it("should not collect", () => {
    const { variadic } = arg({
      name: "port",
      schema: z.string().transform((v) => parseInt(v, 10)),
    });

    assertEquals(variadic, false);
  });

  it("should have a default value", () => {
    const { defaultValue } = arg({
      name: "port",
      schema: z
        .string()
        .transform((v) => parseInt(v, 10))
        .default("8080"),
    });

    assertEquals(defaultValue, 8080);
  });

  it("should not have a default value", () => {
    const { defaultValue } = arg({
      name: "port",
      schema: z.string().transform((v) => parseInt(v, 10)),
    });

    assertEquals(defaultValue, undefined);
  });
});
