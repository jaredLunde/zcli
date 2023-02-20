// deno-lint-ignore-file no-explicit-any
import { CommandFactory } from "./init.ts";
import { flag, flags, getDefault, innerType, walkFlags } from "./flags.ts";
import { Command } from "./command.ts";
import * as intl from "./intl.ts";
import { z } from "./z.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.20.2";
import { walkArgs } from "./args.ts";

export async function zcliJson<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(
  commandFactory: CommandFactory<Context, any>,
  root: Command<any, any, any>,
): Promise<ZcliJson> {
  let json: ZcliJson;

  function zcliJsonCommand<
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
      .run(function ({ args, flags, ctx }) {
        function generateCommand(
          command: Command<any, any, any>,
        ): ZcliJsonCommand {
          const commands: ZcliJsonCommand[] = [];

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
            if ((flag.hidden && !flags.all)) return;
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
              description: flag.long(ctx) || flag.short(ctx) || "",
              summary: flag.short(ctx) || "",
              required: !(flag instanceof z.ZodOptional) &&
                !(flag instanceof z.ZodDefault) && name !== "help",
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
            description: command.long(ctx) || command.short(ctx) || "",
            summary: command.short(ctx) ?? "",
            deprecated: command.deprecated,
            arguments: command.args
              ? {
                description: command.args.long(ctx) ?? "",
                summary: command.args.short(ctx) ?? "",
                items: a,
              }
              : undefined,
            flags: commandFlags,
            commands: commands,
          };
        }

        json = {
          "zcli": "1.0.0",
          info: {
            name: root.name,
            version: ctx?.meta.version,
            commit: ctx?.meta.commit,
            buildDate: ctx?.meta.date,
            description: root.long(ctx) || root.short(ctx) || "",
            summary: root.short(ctx) || "",
          },
          commands: [generateCommand(root)],
        };
      });
  }

  const command = zcliJsonCommand(commandFactory);
  await command.execute([]);
  return json!;
}

export type ZcliJson = {
  zcli: "1.0.0";
  info: {
    name: string;
    version: string;
    commit?: string;
    buildDate?: string;
    description: string;
    summary: string;
  };
  commands: ZcliJsonCommand[];
};

export type ZcliJsonCommand = {
  name: string;
  description: string;
  summary: string;
  deprecated?: string;
  arguments: undefined | {
    description: string;
    summary: string;
    items: ZcliJsonArgument[];
  };
  flags: ZcliJsonFlag[];
  commands: ZcliJsonCommand[];
};

export type ZcliJsonArgument = {
  position: number;
  summary: string;
  required: boolean;
  variadic: boolean;
  schema: any;
};

export type ZcliJsonFlag = {
  name: string;
  aliases: string[];
  description?: string;
  summary?: string;
  required: boolean;
  collects: boolean;
  negatable: boolean;
  default?: any;
  schema: any;
};
