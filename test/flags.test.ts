// deno-lint-ignore-file no-explicit-any
import { describe, it } from "https://deno.land/std@0.177.0/testing/bdd.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.177.0/testing/asserts.ts";

import {
  flag,
  flags,
  isFlag,
  isFlags,
  isGlobalFlag,
  walkFlags,
} from "../mod.ts";
import { getDefault } from "../flags.ts";

describe("flag()", () => {
  it("should proxy Zod methods", () => {
    const zodString = flag().string().default("hello").describe("hello world");
    assert(isFlag(zodString));
    assertEquals(getDefault(zodString), "hello");
    assertEquals(zodString.description, "hello world");
  });

  it("should be hidden", () => {
    const zodString = flag({ hidden: true }).string().transform((value) =>
      value.toUpperCase()
    );
    assert(isFlag(zodString));
    assertEquals(zodString.hidden, true);
  });

  it("should be negatable", () => {
    const zodString = flag({ negatable: true }).string().transform((value) =>
      value.toUpperCase()
    );
    assert(isFlag(zodString));
    assertEquals(zodString.negatable, true);
  });

  it("should have a short description", () => {
    const zodString = flag({ short: "hello" }).string().refine((value) => {
      if (value.length < 5) throw new Error("too short");
      return value;
    });
    assert(isFlag(zodString));
    assertEquals(zodString.short({} as any), "hello");
  });

  it("should have a short description 2", () => {
    const zodString = flag({ short: () => "hello" }).string().refine(
      (value) => {
        if (value.length < 5) throw new Error("too short");
        return value;
      },
    );
    assert(isFlag(zodString));
    assertEquals(zodString.short({} as any), "hello");
  });

  it("should have a long description", () => {
    const zodString = flag({ long: "hello" }).string();
    assert(isFlag(zodString));
    assertEquals(zodString.long({} as any), "hello");
  });

  it("should have a long description 2", () => {
    const zodString = flag({ long: () => "hello" }).string();
    assert(isFlag(zodString));
    assertEquals(zodString.long({} as any), "hello");
  });

  it("should be deprecated", () => {
    const zodString = flag({ deprecated: "Use something else instead" })
      .string();
    assert(isFlag(zodString));
    assertEquals(zodString.deprecated, "Use something else instead");
    assertEquals(zodString.hidden, true);
  });

  it("should have aliases", () => {
    const zodString = flag({ aliases: ["s"] })
      .string();
    assert(isFlag(zodString));
    assertEquals(zodString.aliases, ["s"]);
  });

  it("should be global", () => {
    const zodString = flag({ aliases: ["s"] })
      .string();
    assert(isFlag(zodString));
    assert(!isGlobalFlag(zodString));
    zodString.__global = true;
    assert(isFlag(zodString));
    assert(isGlobalFlag(zodString));
  });
});

describe("flags()", () => {
  it("should proxy Zod methods", () => {
    const opts = flags({
      foo: flag().string().default("hello").describe("hello world"),
    });

    assert(isFlags(opts));
    assert(isFlags(opts.merge(flags({
      bar: flag().string().default("hello").describe("hello world"),
    }))));
  });

  it("should have nested flags", () => {
    const opts = flags({
      foo: flags({
        bar: flag().string().default("hello").describe("hello world"),
      }),
    });

    assert(isFlags(opts));
    assert(isFlags(opts.shape.foo));
  });
});

describe("walkFlags()", () => {
  it("should walk nested flags", () => {
    const opts = flags({
      foo: flags({
        bar: flag().string().default("hello"),
      }),
      baz: flag().number().default(10),
    });

    const collect: string[] = [];

    walkFlags(opts, (_flag, name) => {
      collect.push(name);
    });

    assertEquals(collect, ["baz", "foo.bar"]);
  });
});
