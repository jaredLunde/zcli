# zCLI

> A framework for building type-safe commandline tools powered by Zod

## Getting started

```ts
import * as zc from "https://deno.land/x/zcli/mod.ts";
import { z } from "https://deno.land/x/zcli/z.ts";

const cli = zc.init({
  globalFlags: zc.flags({
    verbose: zc.flag({ aliases: ["v"] }).oboolean(),
    raw: zc.flag({ aliases: ["r"] }).oboolean(),
  }),

  ctx: {
    env: zc.env({
      DEBUG: zc.env.bool().default("false"),
    }),

    meta: {
      version: "1.3.2",
      build: Deno.build,
      commit: "development",
      date: new Date().toISOString(),
    },
  },
});

const fetcher = cli
  .command("fetcher", {
    args: zc
      .args({
        short: "The URL to fetch",
      })
      .tuple([z.string().url()]),

    flags: zc.flags({
      method: zc
        .flag({ short: "The HTTP method to use", aliases: ["m"] })
        .enum(["POST", "GET", "PUT", "PATCH", "DELETE", "HEAD"])
        .default("GET"),
      headers: zc
        .flag({ short: "Add headers to the request", aliases: ["H"] })
        .array(z.string())
        .optional(),
      data: zc
        .flag({
          short: "Send request data",
          aliases: ["d"],
        })
        .ostring(),
    }),
  })
  .describe("Fetch a resource from the internet")
  .preRun(({ flags, ctx }) => {
    if (ctx.env.get("DEBUG")) {
      console.log("Fetching:", flags.url);
    }
  })
  .run(async ({ flags, ctx }) => {
    if (ctx.env.get("DEBUG")) {
      console.log("Fetching:", flags.url);
    }

    const response = await fetch(flags.url, {
      method: flags.method,
      headers: new Headers(
        flags.headers?.map((h) => h.split(":").map((s) => s.trim()))
      ),
      body: flags.data,
    });

    if (flags.json) {
      console.log(await response.json());
    } else {
      console.log("Response:", response);
    }
  });

if (import.meta.main) {
  await fetcher.execute();
}
```
