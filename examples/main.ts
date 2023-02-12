import { z, create, env, config } from "../mod.ts";
import { arg, args } from "../src/args.ts";
import { globalFlags, flag, flags } from "../src/flags.ts";
import * as intl from "../src/intl.ts";
import { table } from "../src/lib/simple-table.ts";
//import * as bash from "../src/completions/bash.ts";

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
        format: "ini",
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
      // Deno architecture
      build: Deno.build,
      commit: "development",
      date: new Date().toISOString(),
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

const fly = command("fly", {
  commands: [
    command("launch").run(async (args, { config }) => {
      console.log("launching");
      await config.set("version.date", new Date().toISOString());
      console.log(await config.get("version.date"));
    }),

    command("version")
      .run((args, { meta, path }) => {
        console.log(`${path[0]} v${meta.version}`);
        console.log(
          [
            ...table(
              [
                ["Commit", meta.commit],
                ["Build", `${meta.build.os}/${meta.build.arch}`],
                [
                  "Date",
                  intl.date(new Date(meta.date), {
                    dateStyle: "long",
                    timeStyle: "long",
                  }),
                ],
              ],
              {
                indent: 0,
                cellPadding: 2,
              }
            ),
          ].join("\n")
        );
      })
      .describe(
        "Shows version information for the fly command itself, including version number and build date."
      ),
  ],

  args: args([arg("path", z.string())])
    .rest(arg("path", z.string()))
    .optional(),

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
  .describe("fly is a command line interface to the Fly.io platform.")
  .long(description)
  .preRun(async (args, { env, config }) => {
    console.log("Checking if logged in...");
  })
  .run((args, { env }) => {
    console.log(args.bitrate);
    console.log(env.toObject());
    console.log(args);
  })
  .postRun(async (args, { env }) => {
    console.log('A new version is available! Run "fly update" to update.');
  });

//console.log(bash.complete(fly));

if (import.meta.main) {
  await fly.execute();
}

z.util.assertIs;
