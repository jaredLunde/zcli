import { create, env, z } from "../mod.ts";
import { args } from "../args.ts";
import { flag, flags } from "../flags.ts";
import { colors } from "../fmt.ts";
import { table } from "../lib/simple-table.ts";
import { version } from "../version.ts";
import { zcliJson } from "../zcli-json.ts";
import { completion } from "../completion.ts";
import * as ansi from "https://deno.land/x/ansi@1.0.1/mod.ts";

const cli = create({
  globalFlags: flags({
    verbose: flag({
      short: "Enable verbose logging",
      aliases: ["v"],
    }).oboolean(),
    raw: flag({
      short: "Print a raw response output",
      aliases: ["r"],
    }).oboolean(),
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

const fetcher = cli
  .command("fetcher", {
    args: args({
      short: "A URL to fetch.",
    }).tuple([z.string().url()]),

    flags: flags({
      method: flag({
        aliases: ["m"],
        short: "The HTTP method to use",
      }).enum(["POST", "GET", "PUT", "PATCH", "DELETE", "HEAD"])
        .default("GET"),

      headers: flag({
        aliases: ["H"],
        short: "Add headers to the request",
      }).array(z.string()).optional(),

      data: flag({
        aliases: ["d"],
        short: "Send request data",
      }).ostring(),
    }),

    commands: [
      version(cli),
      completion(cli),
      zcliJson(cli),
    ],

    short: "Fetch a resource from the internet",

    long: `
      Fetch a resource from the internet

      This command will fetch a resource from the internet and print the response.
    `,
  })
  .preRun(({ args, ctx }) => {
    if (ctx.env.get("DEBUG")) {
      console.log("Fetching:", args[0]);
    }
  })
  .run(async function* ({ args, flags }) {
    let response: Response | undefined;

    fetch(args[0], {
      method: flags.method,
      headers: new Headers(
        flags.headers?.map((h) => h.split(":").map((s) => s.trim())),
      ),
      body: flags.data,
    }).then((res) => {
      response = res;
    });

    let ticks = "...";

    while (!response) {
      if (!flags.raw) {
        if (ticks !== "...") {
          yield ansi.eraseLines(2);
          yield ansi.cursorUp(2);
        }

        yield "Loading" + ticks;
        ticks = ticks + ".";
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!flags.raw) {
      yield ansi.eraseLines(2) + ansi.cursorUp(1);
    }

    if (flags.raw) {
      yield await response.text();
    } else {
      yield colors.bold("Response");

      for (
        const line of table(
          [
            [colors.blue("URL"), args[0]],
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
  await fetcher.execute();
}
