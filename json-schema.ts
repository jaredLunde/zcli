// deno-lint-ignore-file no-explicit-any
import { CommandFactory } from "./create.ts";
import { flag, flags } from "./flags.ts";
import { Command } from "./command.ts";
import * as intl from "./intl.ts";
import { z } from "./z.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.20.2";
import { dedent } from "./lib/dedent.ts";

export function jsonSchema<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(commandFactory: CommandFactory<Context, any>, options: {
  /**
   * Change the name of the command
   * @default "jsonschema"
   */
  name?: string;
  /**
   * Add aliases for the command
   */
  aliases?: string[];
  /**
   * Whether the command should be hidden from users
   * @default true
   */
  hidden?: boolean;
} = {}) {
  const { name = "jsonschema", hidden = true, aliases } = options;

  return commandFactory.command(name, {
    hidden,
    aliases,
    flags: flags({
      all: flag(
        z.boolean().default(false),
        {
          aliases: ["a"],
        },
      ).describe(
        "Show all commands and flags, including hidden ones.",
      ).long(
        `Show all commands and flags in the output, including hidden ones.`,
      ),
    }),
  })
    .run(async function (args, { bin }) {
      function generateCommand(command: Command<any, any, any>) {
        const commands: z.ZodObject<any>[] = [];

        for (
          const cmd of intl.collate(command.commands, {
            get(cmd) {
              return cmd.name;
            },
          })
        ) {
          if (args.all || !cmd.hidden) {
            commands.push(generateCommand(cmd));
          }
        }

        return {
          name: command.name,
          description: [...dedent(command.longDescription)].join("\n"),
          summary: command.description,
          arguments: command.args &&
            zodToJsonSchema(command.args, { strictUnions: true }),
          flags: command.flags &&
            zodToJsonSchema(command.flags, { strictUnions: true }),
          commands,
        };
      }

      const text = new TextEncoder();

      await Deno.stdout.write(text.encode(
        JSON.stringify(generateCommand(bin), null, 2) + "\n",
      ));
    })
    .describe("Prints the CLI command structure as JSONSchema")
    .long(
      `
      Prints the CLI command structure as JSONSchema. This is useful for
      the purposes of outputting your command structure in a documentable
      format.
      `,
    );
}
