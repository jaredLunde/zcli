// deno-lint-ignore-file no-explicit-any
import { CommandFactory } from "./create.ts";
import { flag, flags } from "./flags.ts";
import * as intl from "./intl.ts";
import { z } from "./z.ts";

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
      const commands = [];

      for (
        const command of intl.collate(bin.commands, {
          get(cmd) {
            return cmd.name;
          },
        })
      ) {
        if (args.all || !command.hidden) {
          commands.push({
            name: command.name,
          });
        }
      }
      const text = new TextEncoder();

      await Deno.stdout.write(text.encode(
        JSON.stringify(
          {
            name: bin.name,
            description: bin.longDescription || bin.description || "",
            commands,
          },
          null,
          2,
        ) + "\n",
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
