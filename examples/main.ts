import { Arg, InferArgName } from "../src/arg.ts";
import * as z from "../src/mod.ts";

const serve = z
  .cmd("serve", {
    args: z
      .args([z.arg("path", z.enum(["fish", "dish", "trish"]))])
      .rest(z.arg("path", z.enum(["fish", "dish", "trish"]))),

    opts: z.opts({
      port: z.opt(z.number().int().min(0).max(65536).default(8080), {
        aliases: ["p"],
      }),
      debug: z.opt(z.boolean().default(false), {
        aliases: ["D"],
      }),
      help: z.opt(z.help(), { aliases: ["h"] }),
    }),

    async run(args, ctx) {
      console.log("args", args);
      return;
    },
  })
  .describe("Serve a directory");

if (import.meta.main) {
  await serve.parse(Deno.args);
}
