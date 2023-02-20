// deno-lint-ignore-file no-explicit-any
import { describe, it } from "https://deno.land/std@0.177.0/testing/bdd.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { z } from "../z.ts";
import { args, isArgs, walkArgs } from "../mod.ts";

describe("args()", () => {
  it("should proxy Zod methods", () => {
    const argv = args().array(z.string()).min(1).max(2);
    assert(isArgs(argv));
  });

  it("should have a short description", () => {
    const argv = args({ short: "hello" }).array(z.string());
    assert(isArgs(argv));
    assertEquals(argv.short({} as any), "hello");
  });

  it("should have a short description 2", () => {
    const argv = args({ short: () => "hello" }).array(z.string());
    assert(isArgs(argv));
    assertEquals(argv.short({} as any), "hello");
  });

  it("should have a long description", () => {
    const argv = args({ long: "hello" }).array(z.string());
    assert(isArgs(argv));
    assertEquals(argv.long({} as any), "hello");
  });

  it("should have a long description 2", () => {
    const argv = args({ long: () => "hello" }).array(z.string());
    assert(isArgs(argv));
    assertEquals(argv.long({} as any), "hello");
  });

  it("should have a usage string", () => {
    const argv = args({ use: "hello" }).array(z.string());
    assert(isArgs(argv));
    assertEquals(argv.usage, "hello");
  });
});

describe("walkArgs()", () => {
  it("should walk array args", () => {
    const argv = args().array(z.string());
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 1);
    assertEquals(a[0].variadic, true);
    assertEquals(a[0].position, 0);
  });

  it("should walk optional array args", () => {
    const argv = args().array(z.string()).optional();
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 1);
    assertEquals(a[0].variadic, true);
    assertEquals(a[0].position, 0);
  });

  it("should walk defaulted array args", () => {
    const argv = args().array(z.string()).default(["a", "b"]);
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 1);
    assertEquals(a[0].variadic, true);
    assertEquals(a[0].position, 0);
  });

  it("should walk tuple args", () => {
    const argv = args().tuple([z.string()]);
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 1);
    assertEquals(a[0].variadic, false);
    assertEquals(a[0].position, 0);
  });

  it("should walk optional tuple args", () => {
    const argv = args().tuple([z.string()]);
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 1);
    assertEquals(a[0].variadic, false);
    assertEquals(a[0].position, 0);
  });

  it("should walk defaulted tuple args", () => {
    const argv = args().tuple([z.string(), z.string()]).default(["a", "b"]);
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 2);
    assertEquals(a[0].variadic, false);
    assertEquals(a[1].variadic, false);
    assertEquals(a[0].position, 0);
    assertEquals(a[1].position, 1);
  });

  it("should walk variadic tuple args", () => {
    const argv = args().tuple([z.string()]).rest(z.string());
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 2);
    assertEquals(a[0].variadic, false);
    assertEquals(a[0].position, 0);

    assertEquals(a[1].variadic, true);
    assertEquals(a[1].position, 1);
  });

  it("should walk optional variadic tuple args", () => {
    const argv = args().tuple([z.string(), z.string()]).rest(z.string());
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 3);
    assertEquals(a[0].variadic, false);
    assertEquals(a[0].position, 0);
    assertEquals(a[1].variadic, false);
    assertEquals(a[1].position, 1);
    assertEquals(a[2].variadic, true);
    assertEquals(a[2].position, 2);
  });

  it("should walk defaulted variadic tuple args", () => {
    const argv = args().tuple([z.string()]).rest(z.string()).default(["a"]);
    const a: any = [];

    walkArgs(argv, (arg, { position, variadic }) => {
      a.push({ arg, position, variadic });
    });

    assertEquals(a.length, 2);
    assertEquals(a[0].variadic, false);
    assertEquals(a[0].position, 0);

    assertEquals(a[1].variadic, true);
    assertEquals(a[1].position, 1);
  });
});
