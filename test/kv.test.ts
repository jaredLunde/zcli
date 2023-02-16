// deno-lint-ignore-file no-explicit-any
import {
  assertSpyCall,
  assertSpyCalls,
  stub,
} from "https://deno.land/std@0.177.0/testing/mock.ts";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.177.0/testing/bdd.ts";
import { kv } from "../src/kv.ts";
import { z } from "../src/z.ts";
import * as path from "https://deno.land/std@0.177.0/path/mod.ts";

describe("kv()", () => {
  it("should set a value", async () => {
    const kvStore = kv(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        path: "kv.jsonc",
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const readTextFile = stub(
      Deno,
      "readTextFile",
      async () => await Promise.resolve("{}"),
    );
    const writeTextFile = stub(Deno, "writeTextFile", async () => {});

    await kvStore.set("foo", "baz");

    assertSpyCalls(statSync, 2);
    assertSpyCall(readTextFile, 0, { args: ["kv.jsonc"] });
    assertSpyCalls(readTextFile, 1);
    assertSpyCall(writeTextFile, 0, {
      args: [
        "kv.jsonc",
        JSON.stringify(
          {
            foo: {
              value: "baz",
              expires: -1,
            },
          },
          null,
          2,
        ),
        {
          mode: 0o600,
        },
      ],
    });

    statSync.restore();
    readTextFile.restore();
    writeTextFile.restore();
  });

  it("should set a value w/ expiration", async () => {
    const kvStore = kv(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        path: "kv.jsonc",
      },
    );

    const dateNow = stub(Date, "now", () => 0);
    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const readTextFile = stub(
      Deno,
      "readTextFile",
      async () => await Promise.resolve("{}"),
    );
    const writeTextFile = stub(Deno, "writeTextFile", async () => {});

    await kvStore.set("foo", "baz", 1000);

    assertEquals(await kvStore.get("foo"), "baz");
    assertEquals(await kvStore.get("foo"), "baz");
    assertSpyCalls(statSync, 2);
    assertSpyCall(readTextFile, 0, { args: ["kv.jsonc"] });
    assertSpyCalls(readTextFile, 1);
    assertSpyCall(writeTextFile, 0, {
      args: [
        "kv.jsonc",
        JSON.stringify(
          {
            foo: {
              value: "baz",
              expires: Date.now() + 1000 * 1000,
            },
          },
          null,
          2,
        ),
        {
          mode: 0o600,
        },
      ],
    });

    statSync.restore();
    readTextFile.restore();
    writeTextFile.restore();
    dateNow.restore();
  });

  it("should filter expired values", async () => {
    const kvStore = kv(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        path: "kv.jsonc",
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const readTextFile = stub(
      Deno,
      "readTextFile",
      async () =>
        await Promise.resolve(
          JSON.stringify({
            foo: {
              value: "bar",
              expires: 0,
            },
          }),
        ),
    );

    assertEquals(await kvStore.get("foo"), undefined);
    assertEquals(await kvStore.get("foo"), undefined);

    statSync.restore();
    readTextFile.restore();
  });

  it("should delete a value", async () => {
    const kvStore = kv(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        path: "kv.jsonc",
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const readTextFile = stub(
      Deno,
      "readTextFile",
      async () =>
        await Promise.resolve(
          JSON.stringify({
            foo: {
              value: "bar",
              expires: -1,
            },
          }),
        ),
    );
    const writeTextFile = stub(Deno, "writeTextFile", async () => {});

    await kvStore.delete("foo");

    assertSpyCalls(statSync, 2);
    assertSpyCall(readTextFile, 0, { args: ["kv.jsonc"] });
    assertSpyCalls(readTextFile, 1);
    assertSpyCall(writeTextFile, 0, {
      args: [
        "kv.jsonc",
        JSON.stringify({}, null, 2),
        {
          mode: 0o600,
        },
      ],
    });

    statSync.restore();
    readTextFile.restore();
    writeTextFile.restore();
  });

  it("should clear", async () => {
    const kvStore = kv(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
        path: "kv.jsonc",
        mode: 0o700,
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const writeTextFile = stub(Deno, "writeTextFile", async () => {});

    await kvStore.clear();

    assertSpyCalls(statSync, 1);
    assertSpyCall(writeTextFile, 0, {
      args: [
        "kv.jsonc",
        JSON.stringify({}),
        {
          mode: 0o700,
        },
      ],
    });

    statSync.restore();
    writeTextFile.restore();
  });

  it("should use a default path", async () => {
    const kvStore = kv(
      {
        foo: z.string(),
      },
      {
        format: "jsonc",
      },
    );

    const statSync = stub(Deno, "statSync", () => {
      return {} as any;
    });
    const readTextFile = stub(Deno, "readTextFile", async () => {
      return await JSON.stringify({});
    });
    const writeTextFile = stub(Deno, "writeTextFile", async () => {});

    await kvStore.set("foo", "bar");

    assertSpyCall(statSync, 0, {
      args: [path.join(Deno.env.get("HOME")!, `.zcli-dev`, `kv.jsonc`)],
    });
    assertSpyCall(statSync, 1, {
      args: [path.join(Deno.env.get("HOME")!, `.zcli-dev`)],
    });
    assertSpyCalls(statSync, 2);
    assertSpyCall(readTextFile, 0, {
      args: [path.join(Deno.env.get("HOME")!, `.zcli-dev`, `kv.jsonc`)],
    });
    assertSpyCall(writeTextFile, 0, {
      args: [
        path.join(Deno.env.get("HOME")!, `.zcli-dev`, `kv.jsonc`),
        JSON.stringify({ foo: { value: "bar", expires: -1 } }, null, 2),
        {
          mode: 0o600,
        },
      ],
    });

    statSync.restore();
    readTextFile.restore();
    writeTextFile.restore();
  });
});
