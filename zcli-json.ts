// deno-lint-ignore-file no-explicit-any
import { CommandFactory } from "./create.ts";
import { flag, flags, innerType, walkFlags } from "./flags.ts";
import { Command } from "./command.ts";
import * as intl from "./intl.ts";
import { z } from "./z.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.20.2";
import { dedent } from "./lib/dedent.ts";
import { walkArgs } from "./args.ts";

export function zcliJson<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(commandFactory: CommandFactory<Context, any>, options: {
  /**
   * Change the name of the command
   * @default "zcli.json"
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
  const { name = "zcli.json", hidden = true, aliases } = options;

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
        const commands: {
          name: string;
          description?: string;
          summary?: string;
          arguments?: any[];
          flags?: any[];
          commands?: any[];
        }[] = [];

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

        const a: any[] = [];
        const hasOptionalArgs = args instanceof z.ZodOptional ||
          args instanceof z.ZodDefault;

        walkArgs(command.args, (arg, { variadic }) => {
          a.push({
            name: arg.name,
            description: [
              ...dedent(arg.longDescription ?? arg.description ?? ""),
            ]
              .join("\n"),
            summary: (arg.description ?? "").trim(),
            required: !hasOptionalArgs,
            variadic: variadic,
            schema: zodToJsonSchema(arg as any, { strictUnions: true }),
          });
        });

        const flags: any[] = [];

        walkFlags(command.flags, (flag, name) => {
          if (flag.__global || (flag.hidden && !args.all)) return;
          const collects = flag instanceof z.ZodArray ||
            flag._def.innerType instanceof z.ZodArray;
          const itemType = collects
            ? flag instanceof z.ZodArray
              ? flag._def.type
              : flag._def.innerType._def.type
            : flag;

          flags.push({
            name,
            aliases: flag.aliases,
            description: [
              ...dedent(flag.longDescription ?? flag.description ?? ""),
            ]
              .join("\n"),
            summary: (flag.description ?? "").trim(),
            required: !(flag instanceof z.ZodOptional) &&
              !(flag instanceof z.ZodDefault),
            collects,
            negatable: flag.negatable,
            schema: zodToJsonSchema(
              name === "help"
                ? z.boolean().default(false)
                : collects
                ? itemType
                : innerType(flag),
              { strictUnions: true },
            ),
          });
        });

        return {
          name: command.name,
          description: !command.longDescription && !command.description
            ? undefined
            : [...dedent(command.longDescription ?? command.description ?? "")]
              .join("\n"),
          summary: (command.description ?? "").trim(),
          arguments: a,
          flags,
          commands: commands,
        };
      }

      const globalFlags: any[] = [];

      if (commandFactory.globalFlags) {
        walkFlags(commandFactory.globalFlags, (flag, name) => {
          if (flag.hidden && !args.all) return;
          const collects = flag instanceof z.ZodArray ||
            flag._def.innerType instanceof z.ZodArray;
          const itemType = collects
            ? flag instanceof z.ZodArray
              ? flag._def.type
              : flag._def.innerType._def.type
            : flag;

          globalFlags.push({
            name,
            aliases: flag.aliases,
            description: [
              ...dedent(flag.longDescription ?? flag.description ?? ""),
            ]
              .join("\n"),
            summary: (flag.description ?? "").trim(),
            required: !(flag instanceof z.ZodOptional) &&
              !(flag instanceof z.ZodDefault),
            collects,
            negatable: flag.negatable,
            schema: zodToJsonSchema(
              name === "help"
                ? z.boolean().default(false)
                : collects
                ? itemType
                : innerType(flag),
              { strictUnions: true },
            ),
          });
        });
      }

      const text = new TextEncoder();

      await Deno.stdout.write(text.encode(
        JSON.stringify(
          {
            "zcli": "1.0.0",
            info: {
              name: bin.name,
              version: commandFactory.ctx?.meta.version,
              commit: commandFactory.ctx?.meta.commit,
              buildDate: commandFactory.ctx?.meta.date,
              description: [
                ...dedent(bin.longDescription ?? bin.description ?? ""),
              ]
                .join("\n"),
              summary: (bin.description || "").trim(),
            },
            commands: [generateCommand(bin)],
            globalFlags,
          },
          null,
          2,
        ) + "\n",
      ));
    })
    .describe(
      "Prints the CLI command structure to a specification with JSONSchemas.",
    )
    .long(
      `
      Prints the CLI command structure to a specification with JSONSchemas. This is 
      useful for the purposes of outputting your command structure in a documentable
      format.
      `,
    );
}
