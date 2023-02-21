import {
  afterEach,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.177.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  assertSpyCall,
  assertSpyCalls,
  spy,
  Stub,
  stub,
} from "https://deno.land/std@0.177.0/testing/mock.ts";
import { args, flag, flags, init, z } from "../mod.ts";
import { colors } from "../fmt.ts";

describe("command()", () => {
  let stdoutStub: Stub;
  let stderrStub: Stub;
  let exitStub: Stub;

  beforeEach(() => {
    stdoutStub = stub(Deno.stdout, "write");
    stderrStub = stub(Deno.stderr, "write");
    exitStub = stub(Deno, "exit");
  });

  afterEach(() => {
    stdoutStub.restore();
    stderrStub.restore();
    exitStub.restore();
  });

  it("should add custom usage", async () => {
    const cli = init();

    const cmd = cli.command("test", { use: "test <arg>" });
    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(decoder.decode(stdoutStub.calls[1].args[0]), "  test <arg>\n");
  });

  it("should call subcommand", async () => {
    const cli = init();
    const fn = spy();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get", { aliases: ["g"] }).run(fn),
      ],
    });

    await cmd.execute(["get"]);

    assertSpyCalls(fn, 1);
    assertEquals(fn.calls[0].args[0].args, []);
  });

  it("should call subcommand with alias", async () => {
    const cli = init();
    const fn = spy();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get", { aliases: ["g"] }).run(fn),
      ],
    });

    await cmd.execute(["g"]);

    assertSpyCalls(fn, 1);
    assertEquals(fn.calls[0].args[0].args, []);
  });

  it("should call preRun, run, postRun in order", async () => {
    const cli = init();
    const order: string[] = [];
    const preRun = spy(() => {
      order.push("preRun");
    });
    const run = spy(() => {
      order.push("run");
    });
    const postRun = spy(() => {
      order.push("postRun");
    });
    const cmd = cli.command("test").run(run).preRun(preRun).postRun(postRun);

    await cmd.execute([]);

    assertSpyCalls(preRun, 1);
    assertSpyCalls(run, 1);
    assertSpyCalls(postRun, 1);
    assertEquals(order, ["preRun", "run", "postRun"]);
  });

  it("should write strings to stdout in run with a generator", async () => {
    const cli = init();
    const cmd = cli.command("test").run(function* () {
      yield "foo";
      yield "bar";
    });

    await cmd.execute([]);

    assertEquals(decoder.decode(stdoutStub.calls[0].args[0]), "foo\n");
    assertEquals(decoder.decode(stdoutStub.calls[1].args[0]), "bar\n");
  });

  it("should write strings to stdout in run with async generator", async () => {
    const cli = init();
    const cmd = cli.command("test").run(async function* () {
      yield "foo";
      yield "bar";
    });

    await cmd.execute([]);

    assertEquals(decoder.decode(stdoutStub.calls[0].args[0]), "foo\n");
    assertEquals(decoder.decode(stdoutStub.calls[1].args[0]), "bar\n");
  });

  it("should forward --", async () => {
    const cli = init();
    const fn = spy();
    const cmd = cli.command("test").run(fn);

    await cmd.execute(["test", "--", "foo"]);

    assertSpyCalls(fn, 1);
    assertEquals(fn.calls[0].args[0]["--"], ["foo"]);
  });

  it("should parse arguments", async () => {
    const cli = init();
    const fn = spy();
    const cmd = cli.command("test", {
      args: args().array(z.union([z.coerce.number(), z.string()])),
    }).run(fn);

    await cmd.execute(["123", "456", "abc"]);

    assertEquals(fn.calls[0].args[0]["args"], [123, 456, "abc"]);
  });

  it("should throw for invalid arguments", async () => {
    const cli = init();

    const cmd = cli.command("test", {
      args: args().array(z.number()),
    });

    try {
      await cmd.execute(["123", "456", "abc", "def"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stderrStub.calls[0].args[0]),
      "Invalid arguments: expected number, but received string.\n⚘ See --help for more information.\n",
    );
    assertSpyCall(exitStub, 0, { args: [1] });
  });

  it("should parse flags", async () => {
    const cli = init();
    const fn = spy();
    const cmd = cli.command("test", {
      flags: flags({
        foo: flag().oboolean(),
        bar: flag().number(),
        baz: flag({ aliases: ["b"] }).string(),
      }),
    }).run(fn);

    await cmd.execute(["--foo", "--bar", "123", "-b", "baz"]);

    assertEquals(fn.calls[0].args[0]["flags"], {
      foo: true,
      bar: 123,
      baz: "baz",
    });
  });

  it("should throw for invalid flags", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      flags: flags({
        foo: flag().oboolean(),
        bar: flag().number(),
        baz: flag({ aliases: ["b"] }).string(),
      }),
    });

    try {
      await cmd.execute(["--bar", "123"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stderrStub.calls[0].args[0]),
      `Invalid type for flag "baz". Expected string, but received undefined.\n⚘ See --help for more information.\n`,
    );
    assertSpyCall(exitStub, 0, { args: [1] });
  });

  it("should collect array flags", async () => {
    const cli = init();
    const fn = spy();
    const cmd = cli.command("test", {
      flags: flags({
        foo: flag().array(z.string()),
      }),
    }).run(fn);

    await cmd.execute(["--foo", "bar", "--foo", "baz"]);

    assertEquals(fn.calls[0].args[0]["flags"], {
      foo: ["bar", "baz"],
    });
  });

  it("should parse negatable flags", async () => {
    const cli = init();
    const fn = spy();
    const cmd = cli.command("test", {
      flags: flags({
        foo: flag({ negatable: true }).boolean().default(true),
      }),
    }).run(fn);

    await cmd.execute(["--no-foo"]);

    assertEquals(fn.calls[0].args[0]["flags"], {
      foo: false,
    });
  });

  it("should add long description to help", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      long: "This is a test command",
      short: "Test command",
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stdoutStub.calls[0].args[0]),
      `This is a test command\n`,
    );
  });

  it("should fall back to short description in help", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      short: "Test command",
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stdoutStub.calls[0].args[0]),
      `Test command\n`,
    );
  });

  it("should add arguments usage to help", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      args: args().array(z.string()),
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stdoutStub.calls[1].args[0]),
      `  test [arguments...] [flags]\n`,
    );
  });

  it("should add arguments usage to help 2", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      args: args().tuple([z.string()]),
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stdoutStub.calls[1].args[0]),
      `  test <arguments> [flags]\n`,
    );
  });

  it("should add flags usage to help without arguments", async () => {
    const cli = init();
    const cmd = cli.command("test");

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stdoutStub.calls[1].args[0]),
      `  test [flags]\n`,
    );
  });

  it("should add command usage to help", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get", { short: "Hello" }),
        cli.command("hidden", { hidden: true }),
      ],
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stdoutStub.calls[1].args[0]),
      `  test [command]\n`,
    );
    assertEquals(
      decoder.decode(stdoutStub.calls[2].args[0]),
      `  test [flags]\n`,
    );

    assertEquals(
      decoder.decode(stdoutStub.calls[3].args[0]),
      `${colors.bold("\nAvailable Commands")}\n`,
    );
    assertEquals(
      decoder.decode(stdoutStub.calls[4].args[0]),
      `  get   Hello\n`,
    );

    assertEquals(
      decoder.decode(stdoutStub.calls[8].args[0]),
      `\nUse "test [command] --help" for more information about a command.\n`,
    );
  });

  it("should add command aliases to help", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      aliases: ["t"],
      commands: [
        cli.command("get", { short: "Hello" }),
      ],
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }

    assertEquals(
      decoder.decode(stdoutStub.calls[3].args[0]),
      `${colors.bold("\nAliases")}\n`,
    );

    assertEquals(
      decoder.decode(stdoutStub.calls[4].args[0]),
      `  test, t\n`,
    );
  });

  it("should add flags and global flags to help", async () => {
    const cli = init({
      globalFlags: flags({
        bar: flag({ aliases: ["b"], short: "Bar" }).string().default("bar"),
      }),
    });
    const cmd = cli.command("test", {
      flags: flags({
        foo: flag({ aliases: ["f"], long: "Foo" }).string(),
      }),
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
      console.error(_err);
    }
    console.log("wtf", stdoutStub.calls);
    assertEquals(
      decoder.decode(stdoutStub.calls[2].args[0]),
      `${colors.bold("\nFlags")}\n`,
    );
    assertEquals(
      decoder.decode(stdoutStub.calls[3].args[0]),
      `  -f, --foo string  Foo\n`,
    );

    assertEquals(
      decoder.decode(stdoutStub.calls[4].args[0]),
      `${colors.bold("\nGlobal Flags")}\n`,
    );

    assertEquals(
      decoder.decode(stdoutStub.calls[5].args[0]),
      `  -b, --bar  string  Bar (default: bar)\n`,
    );
  });

  it("should add deprecation warning to help", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      deprecated: 'Use "foo" instead',
    });

    try {
      await cmd.execute(["--help"]);
    } catch (_err) {
      // ignore
    }
    assertEquals(
      decoder.decode(stdoutStub.calls[0].args[0]),
      `${colors.bold(colors.red("Deprecated"))}\n`,
    );
    assertEquals(
      decoder.decode(stdoutStub.calls[1].args[0]),
      `  Use "foo" instead\n`,
    );
  });

  it("should show deprecation warning when command is used", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      deprecated: 'Use "foo" instead',
    });

    try {
      await cmd.execute([]);
    } catch (_err) {
      // ignore
    }
    assertEquals(
      decoder.decode(stderrStub.calls[0].args[0]),
      `${colors.yellow("Deprecation Warning")}\n`,
    );
    assertEquals(
      decoder.decode(stderrStub.calls[1].args[0]),
      `Use "foo" instead\n`,
    );
  });

  it("should be hidden if deprecated", () => {
    const cli = init();
    const cmd = cli.command("test", {
      deprecated: 'Use "foo" instead',
    });
    assertEquals(cmd.hidden, true);
  });
});

const decoder = new TextDecoder();
