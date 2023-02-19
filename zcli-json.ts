// deno-lint-ignore-file no-explicit-any
import { CommandFactory } from "./create.ts";
import { flag, flags, getDefault, innerType, walkFlags } from "./flags.ts";
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
    short:
      "Prints the CLI command structure to a specification with JSONSchemas.",
    long: `
      Prints the CLI command structure to a specification with JSONSchemas. This is 
      useful for the purposes of outputting your command structure in a documentable
      format.
    `,
    hidden,
    aliases,
    flags: flags({
      all: flag(
        {
          aliases: ["a"],
          short: "Show all commands and flags, including hidden ones.",
          long:
            `Show all commands and flags in the output, including hidden ones.`,
        },
      ).boolean().default(false),
    }),
  })
    .run(async function ({ args, flags, ctx: { bin } }) {
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
          if (flags.all || !cmd.hidden) {
            commands.push(generateCommand(cmd));
          }
        }

        const a: any[] = [];
        const hasOptionalArgs = args instanceof z.ZodOptional ||
          args instanceof z.ZodDefault;

        walkArgs(command.args, (arg, { position, variadic }) => {
          a.push({
            position,
            summary: (arg.description ?? "").trim(),
            required: !hasOptionalArgs,
            variadic,
            schema: zodToJsonSchema(arg as any, { strictUnions: true }),
          });
        });

        const commandFlags: any[] = [];

        walkFlags(command.flags, (flag, name) => {
          if (flag.__global || (flag.hidden && !flags.all)) return;
          const collects = flag instanceof z.ZodArray ||
            flag._def.innerType instanceof z.ZodArray;
          const itemType = collects
            ? flag instanceof z.ZodArray
              ? flag._def.type
              : flag._def.innerType._def.type
            : flag;
          const defaultValue = getDefault(flag);

          commandFlags.push({
            name,
            aliases: flag.aliases,
            description: [
              ...dedent(flag.longDescription ?? flag.shortDescription ?? ""),
            ]
              .join("\n"),
            summary: (flag.shortDescription ?? "").trim(),
            required: !(flag instanceof z.ZodOptional) &&
              !(flag instanceof z.ZodDefault),
            collects,
            negatable: flag.negatable,
            default: defaultValue,
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
          description: !command.longDescription && !command.shortDescription
            ? undefined
            : [
              ...dedent(
                command.longDescription ?? command.shortDescription ?? "",
              ),
            ]
              .join("\n"),
          summary: (command.shortDescription ?? "").trim(),
          arguments: a,
          flags: commandFlags,
          commands: commands,
        };
      }

      const globalFlags: any[] = [];

      if (commandFactory.globalFlags) {
        walkFlags(commandFactory.globalFlags, (flag, name) => {
          if (flag.hidden && !flags.all) return;
          const collects = flag instanceof z.ZodArray ||
            flag._def.innerType instanceof z.ZodArray;
          const itemType = collects
            ? flag instanceof z.ZodArray
              ? flag._def.type
              : flag._def.innerType._def.type
            : flag;
          const defaultValue = getDefault(flag);

          globalFlags.push({
            name,
            aliases: flag.aliases,
            description: [
              ...dedent(flag.longDescription ?? flag.shortDescription ?? ""),
            ]
              .join("\n"),
            summary: (flag.shortDescription ?? "").trim(),
            required: !(flag instanceof z.ZodOptional) &&
              !(flag instanceof z.ZodDefault),
            collects,
            negatable: flag.negatable,
            default: defaultValue,
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
                ...dedent(bin.longDescription ?? bin.shortDescription ?? ""),
              ]
                .join("\n"),
              summary: (bin.shortDescription || "").trim(),
            },
            commands: [generateCommand(bin)],
            globalFlags,
          },
          null,
          2,
        ) + "\n",
      ));
    });
}
