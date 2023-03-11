// deno-lint-ignore-file no-explicit-any
import {
  assert,
  assertEquals,
  assertSpyCall,
  describe,
  it,
  stub,
} from "./deps.ts";
import { init } from "../mod.ts";
import { flag, flags } from "../flags.ts";
import { z } from "../z.ts";

describe("init()", () => {
  it("should init without context", async () => {
    const cli = init();
    let o: any;

    const cmd = cli.command("test").run((opts) => {
      o = opts;
    });

    await cmd.execute([]);

    assertEquals(o.args, []);
    assertEquals(o.flags, {});
    assertEquals(o.ctx, { path: ["test"], root: cmd });
  });

  it("should init with context", async () => {
    const cli = init({
      ctx: {
        meta: {
          version: "0.1.0",
        },
      },
    });
    let o: any;

    const cmd = cli.command("test").run((opts) => {
      o = opts;
    });

    await cmd.execute([]);

    assertEquals(o.args, []);
    assertEquals(o.flags, {});
    assertEquals(o.ctx, {
      path: ["test"],
      root: cmd,
      meta: { version: "0.1.0" },
    });
  });

  it("should init with global flags", async () => {
    const cli = init({
      globalFlags: flags({
        verbose: flag().oboolean(),
      }),
    });
    let o: any;

    const cmd = cli.command("test").run((opts) => {
      o = opts;
    });

    await cmd.execute(["--verbose"]);

    assertEquals(o.args, []);
    assertEquals(o.flags, { verbose: true });
    // @ts-expect-error: it's cool
    assertEquals(cmd.flags.shape.verbose.__global, true);
  });

  it("should merge global flags with local flags", async () => {
    const cli = init({
      globalFlags: flags({
        verbose: flag().oboolean(),
      }),
    });
    let o: any;

    const cmd = cli.command("test", {
      flags: flags({
        method: flag().enum(["GET", "POST", "PUT", "DELETE"]),
      }),
    }).run((opts) => {
      o = opts;
    });

    await cmd.execute(["--verbose", "--method", "GET"]);

    assertEquals(o.args, []);
    assertEquals(o.flags, { verbose: true, method: "GET" });
    // @ts-expect-error: it's cool
    assertEquals(cmd.flags.shape.verbose.__global, true);
    // @ts-expect-error: it's cool
    assertEquals(cmd.flags.shape.method.__global, false);
  });

  it("should not add a help command if the command has no subcommands", () => {
    const cli = init();
    const cmd = cli.command("test");

    assertEquals(cmd.commands.length, 0);
  });

  it("should add a help command if the command has subcommands", () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get"),
      ],
    });

    assertEquals(cmd.commands.length, 2);
    assertEquals(cmd.commands[1].name, "help");
  });
});

describe("help()", () => {
  it("should write help with --help flag", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get"),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    try {
      await cmd.execute(["--help"]);
    } catch (err) {
      assert(err instanceof z.ZodError);
      assertEquals(err.issues[0].path, ["help"]);
    }

    assertSpyCall(exitStub, 0, { args: [0] });
    assert(decoder.decode(stdoutStub.calls[0].args[0]).includes("Usage"));
    exitStub.restore();
    stdoutStub.restore();
  });

  it("should write help when called without subcommand", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get"),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    try {
      await cmd.execute(["help"]);
    } catch (err) {
      assert(err instanceof z.ZodError);
      assertEquals(err.issues[0].path, ["help"]);
    }

    assertSpyCall(exitStub, 0, { args: [0] });
    assert(decoder.decode(stdoutStub.calls[0].args[0]).includes("Usage"));
    exitStub.restore();
    stdoutStub.restore();
  });

  it("should write help for subcommand", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get", { short: "Get" }),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    await cmd.execute(["help", "get"]);

    assertSpyCall(exitStub, 0, { args: [0] });
    assertEquals(decoder.decode(stdoutStub.calls[0].args[0]), "Get\n");
    exitStub.restore();
    stdoutStub.restore();
  });

  it("should write available commands", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get", { short: "Get" }),
        cli.command("a", { short: "A", hidden: true }),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    await cmd.execute(["help", "commands"]);

    assertSpyCall(exitStub, 0, { args: [0] });
    assert(
      decoder.decode(stdoutStub.calls[1].args[0]).startsWith("  get"),
    );
    exitStub.restore();
    stdoutStub.restore();
  });

  it("should write all available commands", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("get", { short: "Get" }),
        cli.command("a", { short: "A", hidden: true }),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    await cmd.execute(["help", "commands", "--all"]);

    assertSpyCall(exitStub, 0, { args: [0] });
    assert(
      decoder.decode(stdoutStub.calls[1].args[0]).startsWith("  a"),
    );
    exitStub.restore();
    stdoutStub.restore();
  });

  it("should exit 1 if command not found", async () => {
    const cli = init();
    const cmd = cli.command("test", {
      commands: [
        cli.command("a", { short: "A", hidden: true }),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stderrStub = stub(Deno.stderr, "write");

    try {
      await cmd.execute(["help", "b"]);
    } catch (err) {
      assert(err instanceof z.ZodError);
    }

    assertSpyCall(exitStub, 0, { args: [1] });
    assert(
      decoder.decode(stderrStub.calls[0].args[0]).startsWith(
        "Invalid arguments:",
      ),
    );
    exitStub.restore();
    stderrStub.restore();
  });
});

const decoder = new TextDecoder();
