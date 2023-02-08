import { z, create, env } from "../src/mod.ts";

const zcli = create({
  ctx: {
    fish: "fosh",
    env: env({
      DEBUG: env.bool().default("false"),
      JSON: env.json().optional(),
    }),
  },
});

const help = zcli
  .cmd("help", {
    args: zcli.args([zcli.arg("command", z.enum(["deploy"]))]).optional(),
    opts: zcli.opts({
      help: zcli.helpOpt(),
      all: zcli.opt(z.boolean(), {
        aliases: ["a"],
      }),
    }),
  })
  .run((args, { env }) => {
    console.log(env.toObject());
    //console.log(args);
  });

const serve = zcli
  .cmd("serve", {
    cmds: [help],

    args: zcli
      .args([zcli.arg("path", z.string()), zcli.arg("creep", z.string())])
      .rest(zcli.arg("path", z.string())),

    opts: zcli.opts({
      port: zcli.opt(z.number().int().min(0).max(65536).default(8080), {
        aliases: ["p"],
      }),
      debug: zcli.opt(z.boolean(), {
        aliases: ["D"],
      }),
      help: zcli.helpOpt(),
    }),
  })
  .describe("Serve a directory.")
  .run((args, { env }) => {
    console.log(env.toObject());
    // console.log(args);
  });

if (import.meta.main) {
  await serve.parse(Deno.args);
}
