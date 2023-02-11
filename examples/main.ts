import { z, create, env, config } from "../mod.ts";
import { arg, args } from "../src/arg.ts";
import { globalOpts, opt, opts } from "../src/opt.ts";

const zcli = create({
  globalOpts: globalOpts({
    debug: opt(z.boolean().default(false)).describe("Enable debug mode"),
    json: opt(z.boolean().default(false), { aliases: ["j"] }).describe(
      "Display the output as JSON"
    ),
    verbose: opt(z.boolean().default(false)).describe("Display verbose output"),
  }),

  ctx: {
    env: env({
      DEBUG: env.bool().default("false"),
      JSON: env.json(z.object({ cool: z.string() })).optional(),
    }),

    config: config(
      z.object({
        path: z.string(),
        format: z.enum(["json", "yaml", "toml"]).default("toml"),
        version: z.object({
          number: z.string(),
          date: z.string(),
        }),
        types: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
          })
        ),
      }),
      {
        defaultConfig: {
          path: "$HOME/.fly/config.toml",
          format: "toml",
          version: {
            number: "0.0.0",
            date: "2021-01-01",
          },
          types: [],
        },
      }
    ),

    meta: {
      version: "0.0.0",
    },
  },
});

const description = `
fly is a command line interface to the Fly.io platform.

It allows users to manage authentication, application launch,
deployment, network configuration, logging and more with just the
one command.

  * Launch an app with the launch command
  * Deploy an app with the deploy command
  * View a deployed web application with the open command
  * Check the status of an application with the status command
  
To read more, use the docs command to view Fly's help on the web.
`;

const fly = zcli
  .cmd("fly", {
    cmds: [
      zcli.cmd("launch", {}).run(() => {
        console.log("launching");
      }),
    ],

    args: args([arg("path", z.string())])
      .rest(arg("path", z.string()))
      .optional(),

    opts: opts({
      port: opt(z.number().int().min(0).max(65536).default(8080), {
        aliases: ["p"],
      }).describe("The port to listen on"),
      mode: opt(z.enum(["development", "production"]).optional(), {
        aliases: ["m"],
      }).describe("The mode to run in"),
    }),
  })
  .describe(description)
  .run((args, { env }) => {
    console.log(env.toObject());
    console.log(args);
  });

if (import.meta.main) {
  await fly.parse(Deno.args);
}
