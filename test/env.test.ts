import { stub } from "https://deno.land/std@0.177.0/testing/mock.ts";
import {
  assertEquals,
  assertExists,
  assertThrows,
} from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.177.0/testing/bdd.ts";
import { z } from "../z.ts";
import { env } from "../mod.ts";

const originalEnv = Deno.env.toObject();

// @ts-expect-error: it's fine
let exitStub = stub(Deno, "exit", () => {});

beforeEach(() => {
  exitStub.restore();
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    Deno.env.set(key, value);
  }

  // @ts-expect-error: it's fine
  exitStub = stub(Deno, "exit", () => {});
});

afterAll(() => {
  exitStub.restore();
});

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
      assertThrows(() => {
        env({
          PORT: z.string().transform((v) => parseInt(v, 10)),
        });
      });
    });

    it("should return a parsed object", () => {
      Deno.env.set("PORT", "8080");

      const e = env({
        PORT: z.string().transform((v) => parseInt(v, 10)),
      });

      assertEquals(e.toObject(), { PORT: 8080 });
    });

    it('should work without an "env" schema', () => {
      const e = env();
      assertExists(e.toObject().HOME);
      assertExists(e.get("HOME"));
    });
  });
});

describe("env.bool()", () => {
  it("should return a boolean", () => {
    Deno.env.set("DEBUG", "false");

    const e = env({
      DEBUG: env.bool(),
    });

    assertEquals(e.get("DEBUG"), false);

    e.set("DEBUG", "true");
    assertEquals(e.get("DEBUG"), true);

    e.set("DEBUG", "1");
    assertEquals(e.get("DEBUG"), true);

    e.set("DEBUG", "0");
    assertEquals(e.get("DEBUG"), false);
  });

  it("should return a boolean w/ default", () => {
    const e = env({
      DEBUG: env.bool().default("false"),
    });

    assertEquals(e.get("DEBUG"), false);
  });
});

describe("env.int()", () => {
  it("should return an integer", () => {
    Deno.env.set("PORT", "8080");

    const e = env({
      PORT: env.int(),
    });

    assertEquals(e.get("PORT"), 8080);
  });

  it("should return an integer w/ default", () => {
    const e = env({
      PORT: env.int().default("8080"),
    });

    assertEquals(e.get("PORT"), 8080);
  });

  it("should throw an error if the value is not an integer", () => {
    Deno.env.set("PORT", "zb8080.0");

    assertThrows(() => {
      env({
        PORT: env.int(),
      });
    });
  });
});

describe("env.port()", () => {
  it("should return a port", () => {
    Deno.env.set("PORT", "8080");

    const e = env({
      PORT: env.port(),
    });

    assertEquals(e.get("PORT"), 8080);
  });

  it("should return a port w/ default", () => {
    const e = env({
      PORT: env.port().default("8080"),
    });

    assertEquals(e.get("PORT"), 8080);
  });

  it("should throw an error if the value is not a port", () => {
    Deno.env.set("PORT", "zb8080.0");

    assertThrows(() => {
      env({
        PORT: env.port(),
      });
    });
  });

  it("should throw if port is out of range", () => {
    Deno.env.set("PORT", "999999");

    assertThrows(() => {
      env({
        PORT: env.port(),
      });
    });
  });
});

describe("env.number()", () => {
  it("should return a number", () => {
    Deno.env.set("PI", "3.14");

    const e = env({
      PI: env.number(),
    });

    assertEquals(e.get("PI"), 3.14);
  });

  it("should return a number w/ default", () => {
    const e = env({
      PI: env.number().default("3.14"),
    });

    assertEquals(e.get("PI"), 3.14);
  });

  it("should throw an error if the value is not a number", () => {
    Deno.env.set("PI", "zb3.14");

    assertThrows(() => {
      env({
        PI: env.number(),
      });
    });
  });
});

describe("env.url()", () => {
  it("should return a URL", () => {
    Deno.env.set("URL", "https://example.com");

    const e = env({
      URL: env.url(),
    });

    assertEquals(e.get("URL"), "https://example.com");
  });

  it("should return a URL w/ default", () => {
    const e = env({
      URL: env.url().default("https://example.com"),
    });

    assertEquals(e.get("URL"), "https://example.com");
  });

  it("should throw an error if the value is not a URL", () => {
    Deno.env.set("URL", "zb3.14");

    assertThrows(() => {
      env({
        URL: env.url(),
      });
    });
  });
});

describe("env.json()", () => {
  it("should return a JSON object", () => {
    Deno.env.set("JSON", '{"foo":"bar"}');

    const e = env({
      JSON: env.json(z.object({ foo: z.string() })),
    });

    assertEquals(e.get("JSON"), { foo: "bar" });
  });

  it("should return a JSON object w/ default", () => {
    const e = env({
      JSON: env
        .json(z.object({ foo: z.string() }))
        .default(JSON.stringify({ foo: "bar" })),
    });

    assertEquals(e.get("JSON"), { foo: "bar" });
  });

  it("should throw an error if the value is not a JSON object", () => {
    Deno.env.set("JSON", "zb3.14");

    assertThrows(() => {
      env({
        JSON: env.json(z.object({ foo: z.string() })),
      });
    });
  });
});

describe("env.string()", () => {
  it("should return a string", () => {
    Deno.env.set("FOO", "bar");

    const e = env({
      FOO: env.string(),
    });

    assertEquals(e.get("FOO"), "bar");
  });

  it("should return a string w/ default", () => {
    const e = env({
      FOO: env.string().default("bar"),
    });

    assertEquals(e.get("FOO"), "bar");
  });
});
