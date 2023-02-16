import { parse } from "./flags-parser.ts";
import { describe, it } from "https://deno.land/std@0.177.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

const defaults = {
  bools: {},
  numbers: {},
  aliases: {},
  collect: {},
  negatable: {},
};

describe("flagsParser.parse()", () => {
  describe("arguments", () => {
    it("should parse a single argument", () => {
      const args = parse(["foo"], defaults);
      assertEquals(args._, ["foo"]);
    });

    it("should parse multiple arguments", () => {
      const args = parse(["foo", "bar"], defaults);
      assertEquals(args._, ["foo", "bar"]);
    });

    it("should parse arguments after flags", () => {
      const args = parse(["foo", "--flag", "-d=true", "bar"], defaults);
      assertEquals(args._, ["foo", "bar"]);
    });
  });

  describe("--", () => {
    it("should parse arguments after --", () => {
      const args = parse(["foo", "--", "bar", "--baz", "-b"], defaults);
      assertEquals(args._doubleDash, ["bar", "--baz", "-b"]);
    });
  });

  describe("long flags", () => {
    it("should parse a boolean long", () => {
      const args = parse(["--debug"], { ...defaults, bools: { debug: true } });
      assertEquals(args.debug, true);
    });

    it("should parse a boolean long 2", () => {
      const args = parse(["--debug", "true"], {
        ...defaults,
        bools: { debug: true },
      });
      assertEquals(args.debug, true);
    });

    it("should parse a boolean long 3", () => {
      const args = parse(["--debug", "false"], {
        ...defaults,
        bools: { debug: true },
      });
      assertEquals(args.debug, false);
    });

    it("should parse an empty string long", () => {
      const args = parse(["--debug"], { ...defaults });
      assertEquals(args.debug, "");
    });

    it("should parse a string long", () => {
      const args = parse(["--debug", "true"], { ...defaults });
      assertEquals(args.debug, "true");
    });

    it('should parse a long with "="', () => {
      const args = parse(["--debug=true"], { ...defaults });
      assertEquals(args.debug, "true");
    });

    it("should parse a number long", () => {
      const args = parse(["--debug", "123"], {
        ...defaults,
        numbers: { debug: true },
      });
      assertEquals(args.debug, 123);
    });

    it("should parse a number long 2", () => {
      const args = parse(["--debug=1e3"], {
        ...defaults,
        numbers: { debug: true },
      });

      assertEquals(args.debug, 1e3);
    });

    it("should parse a number long 3", () => {
      const args = parse(["--debug=1.25"], {
        ...defaults,
        numbers: { debug: true },
      });

      assertEquals(args.debug, 1.25);
    });

    it("should parse a number long 4", () => {
      const args = parse(["--debug", "1.25"], {
        ...defaults,
        numbers: { debug: true },
      });

      assertEquals(args.debug, 1.25);
    });

    it("should parse a negatable boolean", () => {
      const args = parse(["--no-debug"], {
        ...defaults,
        bools: { debug: true },
        negatable: { debug: true },
      });

      assertEquals(args.debug, false);
    });

    it("should set a nested number long", () => {
      const args = parse(["--debug.foo", "123", "--debug.bar", "123"], {
        ...defaults,
        numbers: { "debug.foo": true },
      });
      // @ts-expect-error: no biggie
      assertEquals(args.debug.foo, 123);
      // @ts-expect-error: no biggie
      assertEquals(args.debug.bar, "123");
    });
  });

  describe("short flags", () => {
    it("should parse a boolean short with no value", () => {
      const args = parse(["-d"], { ...defaults, bools: { d: true } });
      assertEquals(args.d, true);
    });

    it("should parse a boolean short with a value", () => {
      const args = parse(["-d", "true"], { ...defaults, bools: { d: true } });
      assertEquals(args.d, true);
    });

    it("should parse a boolean short with a false", () => {
      const args = parse(["-d", "false"], { ...defaults, bools: { d: true } });
      assertEquals(args.d, false);
    });

    it("should parse multiple boolean shorts", () => {
      const args = parse(["-fdhpg"], {
        ...defaults,
        bools: { f: true, d: true, p: true, g: true },
      });
      assertEquals(args.f, true);
      assertEquals(args.d, true);
      assertEquals(args.h, "");
      assertEquals(args.p, true);
      assertEquals(args.g, true);
    });

    it("should parse a string short with no value", () => {
      const args = parse(["-d"], { ...defaults });
      assertEquals(args.d, "");
    });

    it("should parse a string short with a value", () => {
      const args = parse(["-d", "false"], { ...defaults });
      assertEquals(args.d, "false");
    });

    it("should parse a number short with a value", () => {
      const args = parse(["-d", "0"], { ...defaults, numbers: { d: true } });
      assertEquals(args.d, 0);
    });

    it("should parse a number short with a value 2", () => {
      const args = parse(["-d", "1e4"], { ...defaults, numbers: { d: true } });
      assertEquals(args.d, 1e4);
    });
    it("should parse a number short with a negative value", () => {
      const args = parse(["-d", "-1"], { ...defaults, numbers: { d: true } });
      assertEquals(args.d, -1);
    });

    it("should parse a number short with a value 3", () => {
      const args = parse(["-d=1e4"], { ...defaults, numbers: { d: true } });
      assertEquals(args.d, 1e4);
    });

    it("should parse a number short with a value 4", () => {
      const args = parse(["-fd1e4"], { ...defaults, numbers: { d: true } });
      assertEquals(args.d, 1e4);
      assertEquals(args.f, "");
    });
  });

  describe("collect", () => {
    it("should collect a single value", () => {
      const args = parse(["--foo", "bar"], {
        ...defaults,
        collect: { foo: true },
      });
      assertEquals(args.foo, ["bar"]);
    });

    it("should collect multiple values", () => {
      const args = parse(["--foo", "bar", "--foo", "baz", "-f", "buz"], {
        ...defaults,
        aliases: { f: "foo" },
        collect: { foo: true },
      });

      assertEquals(args.foo, ["bar", "baz", "buz"]);
    });
  });

  describe("multiple flags", () => {
    it("should parse multiple flags", () => {
      const args = parse(["-f", "-d", "--num", "86", "arg"], {
        ...defaults,
        bools: { f: true, d: true },
        numbers: { num: true },
      });
      assertEquals(args.f, true);
      assertEquals(args.d, true);
      assertEquals(args.num, 86);
      assertEquals(args._, ["arg"]);
    });
  });
});
