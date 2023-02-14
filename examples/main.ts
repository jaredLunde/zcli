import { z, create, env, config, kv } from "../mod.ts";
import { arg, args } from "../src/args.ts";
import { globalFlags, flag, flags } from "../src/flags.ts";
import * as zsh from "../src/completions/zsh.ts";

const { command } = create({
  globalFlags: globalFlags({
    debug: flag(z.boolean().default(false)).describe("Enable debug mode"),
    json: flag(z.boolean().default(false), { aliases: ["j"] }).describe(
      "Display the output as JSON"
    ),
    verbose: flag(z.boolean().default(false)).describe(
      "Display verbose output"
    ),
  }),

  ctx: {
    env: env({
      DEBUG: env.bool().default("false"),
      JSON: env.json(z.object({ cool: z.string() })).optional(),
    }),

    cache: kv({
      latestVersion: z.string().optional(),
    }),

    config: config(
      {
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
      },
      {
        format: "ini",
        defaultConfig: {
          path: "$HOME/.zcli/config.toml",
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
      version: "1.3.2",
      build: Deno.build,
      commit: "development",
      date: new Date().toISOString(),
    },
  },
});

const zcli = command("zcli", {
  commands: [
    command("launch", {
      commands: [
        command("app", {
          args: args([arg("name", z.string())]),
          flags: flags({
            type: flag(z.enum(["web", "native"]).default("web")).describe(
              "The type of app to launch"
            ),
          }),
        }).run((args) => {
          console.log(`launching ${args.type} app`, args.name);
        }),
      ],
    }).run(async (args, { config, cache }) => {
      console.log("launching");
      await config.set("version.date", new Date().toISOString());
      console.log(await config.get("version.date"));
    }),

    command("version")
      .run((args, { meta, path }) => {
        console.log(
          `${path[0]} v${meta.version} (build date: ${meta.date} commit: ${meta.commit})`
        );
      })
      .describe("Show version information")
      .long(
        "Shows version information for the zcli command itself, including version number and build date."
      ),
  ],

  // args: args([arg("path", z.string())])
  //   .rest(arg("path", z.string()))
  //   .optional(),

  flags: flags({
    port: flag(z.array(z.number().int().min(0).max(65536)).default([8080]), {
      aliases: ["p"],
    }).describe("The port to listen on"),
    mode: flag(z.enum(["development", "production"]).optional(), {
      aliases: ["m"],
    }).describe("The mode to run in"),
    bitrate: flags({
      audio: flag(z.number().default(128)).describe("The audio bitrate to use"),
      video: flag(z.number().default(256)).describe("The video bitrate to use"),
    }).optional(),
  }),
})
  .describe("zcli is a command line interface to the Fly.io platform.")
  .long(
    `
    zcli is a command line interface to the Fly.io platform.
    
    It allows users to manage authentication, application launch,
    deployment, network configuration, logging and more with just the
    one command.
    
      * Launch an app with the launch command
      * Deploy an app with the deploy command
      * View a deployed web application with the open command
      * Check the status of an application with the status command
      
    To read more, use the docs command to view Fly's help on the web.
    `
  )
  .preRun(async (args, { env, config }) => {
    console.log("Checking if logged in...");
  })
  .run((args, { env }) => {
    console.log(args.bitrate);
    console.log(env.toObject());
    console.log(args);
  })
  .postRun(async (args, { env }) => {
    console.log('A new version is available! Run "zcli update" to update.');
  });

if (import.meta.main) {
  await zcli.execute();
}
