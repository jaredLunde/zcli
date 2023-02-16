import { z, create, env, config, kv } from "../mod.ts";
import { arg, args } from "../src/args.ts";
import { globalFlags, flag, flags } from "../src/flags.ts";

const zcli = create({
  globalFlags: globalFlags({
    verbose: flag(
      z.boolean().default(false).describe("Return verbose output"),
      { aliases: ["v"] }
    ),
    json: flag(
      z.boolean().default(false).describe("Log responses as raw JSON"),
      { aliases: ["j"] }
    ),
  }),

  ctx: {
    env: env({
      DEBUG: env.bool().default("false"),
    }),

    meta: {
      version: "1.3.2",
      build: Deno.build,
      commit: "development",
      date: new Date().toISOString(),
    },
  },
});

const cli = zcli
  .command("fetch", {
    args: args([arg("url", z.string().url().describe("The URL to fetch"))]),

    flags: flags({
      method: flag(
        z
          .enum(["POST", "GET", "PUT", "PATCH", "DELETE", "HEAD"])
          .default("GET")
          .describe("The HTTP method to use"),
        {
          aliases: ["m"],
        }
      ),
      headers: flag(
        z.array(z.string()).optional().describe("Add headers to the request"),
        { aliases: ["H"] }
      ),
      data: flag(z.string().optional().describe("Send request data"), {
        aliases: ["d"],
      }),
    }),
  })
  .describe("Fetch a resource from the internet")
  .preRun((flags, { env }) => {
    if (env.get("DEBUG")) {
      console.log("Fetching:", flags.url);
    }
  })
  .run(async (flags, ctx) => {
    const response = await fetch(flags.url, {
      method: flags.method,
      headers: new Headers(
        flags.headers?.map((h) => h.split("=").map((s) => s.trim()))
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
  await cli.execute();
}
