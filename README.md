# zcli

> A framework for building type-safe commandline tools powered by Zod

## Getting started

```ts
import * as zcli from "https://deno.land/x/zcli/mod.ts";
import { z } from "https://deno.land/x/zcli/z.ts";

const cli = zcli.create({
  globalFlags: zcli.flags({
    verbose: zcli.flag({ aliases: ["v"] }).oboolean(),
    raw: zcli.flag({ aliases: ["r"] }).oboolean(),
  }),

  ctx: {
    env: zcli.env({
      DEBUG: zcli.env.bool().default("false"),
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
    args: zcli
      .args({
        short: "The URL to fetch",
      })
      .tuple([z.string().url()]),

    flags: zcli.flags({
      method: zcli
        .flag({ short: "The HTTP method to use", aliases: ["m"] })
        .enum(["POST", "GET", "PUT", "PATCH", "DELETE", "HEAD"])
        .default("GET"),
      headers: zcli
        .flag({ short: "Add headers to the request", aliases: ["H"] })
        .array(z.string())
        .optional(),
      data: zcli
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
        flags.headers?.map((h) => h.split(":").map((s) => s.trim())),
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
