import { z, create, env, config } from "../mod.ts";

const zcli = create({
  ctx: {
    env: env({
      DEBUG: env.bool().default("false"),
      JSON: env.json().optional(),
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
  .run(async (args, { env, config }) => {
    console.log(await config.get("version.number"));
    await config.set("version.number", "0.0.2");
    const version = await config.get("version.number");
    console.log(version);

    console.log(env.toObject());
    console.log(args);
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

const serve = zcli
  .cmd("fly", {
    cmds: [help],

    args: zcli
      .args([zcli.arg("path", z.string())])
      .rest(zcli.arg("path", z.string()))
      .optional(),

    opts: zcli.opts({
      port: zcli
        .opt(z.number().int().min(0).max(65536).default(8080), {
          aliases: ["p"],
        })
        .describe("The port to listen on"),
      mode: zcli
        .opt(z.enum(["development", "production"]), {
          aliases: ["m"],
        })
        .describe("The mode to run in"),
      debug: zcli
        .opt(z.boolean().default(false), {
          aliases: ["D"],
        })
        .describe("Enable debug mode"),
      help: zcli.helpOpt().describe("Show help"),
    }),
  })
  .describe(description)
  .run((args, { env }) => {
    console.log(env.toObject());
    console.log(args);
  });

if (import.meta.main) {
  await serve.parse(Deno.args);
}
