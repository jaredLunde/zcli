import { assertEquals, describe, it, stub } from "./deps.ts";
import { init, intl } from "../mod.ts";
import { version } from "../version.ts";

describe("version()", () => {
  it("should write version", async () => {
    const cli = init({
      ctx: {
        meta: {
          version: "0.1.0",
        },
      },
    });
    const cmd = cli.command("test", {
      commands: [
        version(cli),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    await cmd.execute(["version"]);

    assertEquals(decoder.decode(stdoutStub.calls[0].args[0]), "test v0.1.0\n");
    exitStub.restore();
    stdoutStub.restore();
  });

  it("should write version w/ build date", async () => {
    const date = new Date();
    const cli = init({
      ctx: {
        meta: {
          version: "0.1.0",
          date: date.toISOString(),
        },
      },
    });
    const cmd = cli.command("test", {
      commands: [
        version(cli),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    await cmd.execute(["version"]);

    assertEquals(
      decoder.decode(stdoutStub.calls[0].args[0]),
      `test v0.1.0 (build date: ${
        intl.date(
          date,
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        )
      })\n`,
    );
    exitStub.restore();
    stdoutStub.restore();
  });

  it("should write version w/ build date and commit", async () => {
    const date = new Date();
    const cli = init({
      ctx: {
        meta: {
          version: "0.1.0",
          date: date.toISOString(),
          commit: "development",
        },
      },
    });
    const cmd = cli.command("test", {
      commands: [
        version(cli),
      ],
    });
    const exitStub = stub(Deno, "exit");
    const stdoutStub = stub(Deno.stdout, "write");

    await cmd.execute(["version"]);

    assertEquals(
      decoder.decode(stdoutStub.calls[0].args[0]),
      `test v0.1.0 (build date: ${
        intl.date(
          date,
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        )
      }; commit: development)\n`,
    );
    exitStub.restore();
    stdoutStub.restore();
  });
});

const decoder = new TextDecoder();
