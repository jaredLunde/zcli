import { create, env, z } from "../mod.ts";
import { arg, args } from "../args.ts";
import { flag, flags, globalFlags } from "../flags.ts";
import { colors } from "../fmt.ts";
import { table } from "../lib/simple-table.ts";
import { version } from "../version.ts";
import { jsonSchema } from "../json-schema.ts";
import { completion } from "../completion.ts";
import * as ansi from "https://deno.land/x/ansi@1.0.1/mod.ts";

const zcli = create({
  globalFlags: globalFlags({
    verbose: flag(
      z.boolean().default(false).describe("Return verbose output"),
      { aliases: ["v"] },
    ),
    json: flag(
      z.boolean().default(false).describe("Log responses as raw JSON"),
      { aliases: ["j"] },
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
        },
      ),
      headers: flag(
        z.array(z.string()).optional().describe("Add headers to the request"),
        { aliases: ["H"] },
      ),
      data: flag(z.string().optional().describe("Send request data"), {
        aliases: ["d"],
      }),
    }),

    commands: [
      version(zcli),
      completion(zcli),
      jsonSchema(zcli),
    ],
  })
  .describe("Fetch a resource from the internet")
  .preRun((flags, { env }) => {
    if (env.get("DEBUG")) {
      console.log("Fetching:", flags.url);
    }
  })
  .run(async function* (flags) {
    let response: Response | undefined;

    fetch(flags.url, {
      method: flags.method,
      headers: new Headers(
        flags.headers?.map((h) => h.split(":").map((s) => s.trim())),
      ),
      body: flags.data,
    }).then((res) => {
      setTimeout(() => {
        response = res;
      }, 10000);
    });

    let ticks = "...";

    while (!response) {
      if (!flags.json) {
        if (ticks !== "...") {
          yield ansi.eraseLines(2);
          yield ansi.cursorUp(2);
        }

        yield "Loading" + ticks;
        ticks = ticks + ".";
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!flags.json) {
      yield ansi.eraseLines(2) + ansi.cursorUp(1);
    }

    if (flags.json) {
      yield await response.text();
    } else {
      yield colors.bold("Response");

      for (
        const line of table(
          [
            [colors.blue("URL"), flags.url],
            [
              colors.blue("Status"),
              colors.green(response.status + "") + " " + response.statusText,
            ],
          ],
          {
            indent: 1,
            cellPadding: 2,
          },
        )
      ) {
        yield line;
      }

      yield colors.blue(" Headers");

      const headers: string[][] = [];

      for (const [key, value] of response.headers) {
        headers.push([colors.yellow(key), value]);
      }

      for (
        const line of table(headers, {
          indent: 2,
          cellPadding: 2,
        })
      ) {
        yield line;
      }

      yield "";

      for (
        const line of table([[colors.blue("Body"), await response.text()]], {
          indent: 1,
          cellPadding: 2,
        })
      ) {
        yield line;
      }
    }
  });

if (import.meta.main) {
  await cli.execute();
}
