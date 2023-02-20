// deno-lint-ignore-file no-explicit-any
import {
  assertSpyCall,
  assertSpyCalls,
  returnsNext,
  stub,
} from "https://deno.land/std@0.177.0/testing/mock.ts";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.177.0/testing/bdd.ts";
import * as path from "https://deno.land/std@0.177.0/path/mod.ts";
import { config } from "../mod.ts";
import { z } from "../z.ts";

describe("config()", () => {
  it("should set a value", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        defaultConfig: {
          foo: "bar",
        },
      },
    );

    const write = stub(cfg, "write", returnsNext([Promise.resolve()]));
    const read = stub(cfg, "read", returnsNext([Promise.resolve({ foo: "" })]));
    await cfg.set("foo", "baz");
    assertSpyCall(write, 0, { args: [{ foo: "baz" }] });
    assertSpyCalls(write, 1);
    assertSpyCall(read, 0, { args: [] });
    assertSpyCalls(read, 1);
  });

  it("should get a value", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        defaultConfig: {
          foo: "bar",
        },
      },
    );

    const read = stub(
      cfg,
      "read",
      returnsNext([Promise.resolve({ foo: "baz" })]),
    );
    assertEquals(await cfg.get("foo"), "baz");
    assertSpyCall(read, 0, { args: [] });
    assertSpyCalls(read, 1);
  });

  it("should delete a value", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        defaultConfig: {
          foo: "bar",
        },
      },
    );

    const write = stub(cfg, "write", returnsNext([Promise.resolve()]));
    const read = stub(
      cfg,
      "read",
      returnsNext([Promise.resolve({ foo: "baz" })]),
    );
    await cfg.delete("foo");
    assertSpyCall(write, 0, { args: [{ foo: "bar" }] });
    assertSpyCalls(write, 1);
    assertSpyCall(read, 0, { args: [] });
    assertSpyCalls(read, 1);
  });

  it("should delete a value that is not required", async () => {
    const cfg = config(
      {
        foo: z.string().optional(),
      },
      {
        defaultConfig: {},
      },
    );

    const write = stub(cfg, "write", returnsNext([Promise.resolve()]));
    const read = stub(
      cfg,
      "read",
      returnsNext([Promise.resolve({ foo: "baz" })]),
    );
    await cfg.delete("foo");
    assertSpyCall(write, 0, { args: [{}] });
    assertSpyCalls(write, 1);
    assertSpyCall(read, 0, { args: [] });
    assertSpyCalls(read, 1);
  });

  it("should clear", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        defaultConfig: {
          foo: "bar",
        },
      },
    );

    const write = stub(cfg, "write", returnsNext([Promise.resolve()]));
    await cfg.clear();
    assertSpyCall(write, 0, { args: [{ foo: "bar" }] });
    assertSpyCalls(write, 1);
  });

  it("should write the config", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        defaultConfig: {
          foo: "bar",
        },
        path: "/tmp/does/not/exist/config.jsonc",
        mode: 0o700,
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      throw new Deno.errors.NotFound();
    });
    const mkdir = stub(Deno, "mkdir", async () => {});
    const writeTextFile = stub(Deno, "writeTextFile", async () => {});
    await cfg.set("foo", "baz");

    assertSpyCall(statSync, 0, { args: ["/tmp/does/not/exist/config.jsonc"] });
    assertSpyCall(mkdir, 0, {
      args: ["/tmp/does/not/exist", { recursive: true }],
    });
    assertSpyCalls(mkdir, 1);
    assertSpyCall(writeTextFile, 0, {
      args: [
        "/tmp/does/not/exist/config.jsonc",
        JSON.stringify({ foo: "baz" }, null, 2),
        {
          mode: 0o700,
        },
      ],
    });
    assertSpyCalls(writeTextFile, 1);
    assertEquals(await cfg.get("foo"), "baz");

    statSync.restore();
    mkdir.restore();
    writeTextFile.restore();
  });

  it("should read the config", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        defaultConfig: {
          foo: "bar",
        },
        path: "/tmp/does/not/exist/config.jsonc",
        mode: 0o700,
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const readTextFile = stub(Deno, "readTextFile", async () => {
      return await JSON.stringify({ foo: "baz" }, null, 2);
    });

    assertEquals(await cfg.get("foo"), "baz");
    assertSpyCall(statSync, 0, { args: ["/tmp/does/not/exist/config.jsonc"] });
    assertSpyCall(readTextFile, 0, {
      args: ["/tmp/does/not/exist/config.jsonc"],
    });

    statSync.restore();
    readTextFile.restore();
  });

  it("should fall back to default if config does not exist on disk", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        defaultConfig: {
          foo: "bar",
        },
        path: "/tmp/does/not/exist/config.jsonc",
        mode: 0o700,
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      throw new Deno.errors.NotFound();
    });
    const readTextFile = stub(Deno, "readTextFile", async () => {
      return await JSON.stringify({ foo: "baz" }, null, 2);
    });

    assertEquals(await cfg.get("foo"), "bar");
    assertSpyCall(statSync, 0, { args: ["/tmp/does/not/exist/config.jsonc"] });
    assertSpyCalls(readTextFile, 0);

    statSync.restore();
    readTextFile.restore();
  });

  it("should fall back to default if config is invalid", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        defaultConfig: {
          foo: "bar",
        },
        path: "/tmp/does/not/exist/config.jsonc",
        mode: 0o700,
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const readTextFile = stub(Deno, "readTextFile", async () => {
      return await JSON.stringify({ foo: 123 }, null, 2);
    });
    const write = stub(cfg, "write", returnsNext([Promise.resolve()]));

    assertEquals(await cfg.get("foo"), "bar");
    assertSpyCall(statSync, 0, { args: ["/tmp/does/not/exist/config.jsonc"] });
    assertSpyCalls(readTextFile, 1);
    assertSpyCall(write, 0, { args: [{ foo: "bar" }] });
    assertSpyCalls(write, 1);

    statSync.restore();
    readTextFile.restore();
  });

  it("should use a default path", async () => {
    const cfg = config(
      {
        foo: z.string(),
      },
      {
        defaultConfig: {
          foo: "bar",
        },
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      throw new Deno.errors.NotFound();
    });

    await cfg.get("foo");

    assertSpyCall(statSync, 0, {
      args: [path.join(Deno.env.get("HOME")!, `.zcli-dev`, `config.toml`)],
    });

    statSync.restore();
  });
});
