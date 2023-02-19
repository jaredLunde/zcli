// deno-lint-ignore-file no-explicit-any
import { getDefault, innerType, walkFlags } from "./flags.ts";
import { Command } from "./command.ts";
import * as intl from "./intl.ts";
import { z } from "./z.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.20.2";
import { dedent } from "./lib/dedent.ts";
import { walkArgs } from "./args.ts";

export async function zcliJson<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(
  command: Command<Context, any, any>,
  config: { all?: boolean } = {},
) {
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
      if (config.all || !cmd.hidden) {
        commands.push(generateCommand(cmd));
      }
    }

    const a: any[] = [];
    const hasOptionalArgs = command.args instanceof z.ZodOptional ||
      command.args instanceof z.ZodDefault;

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
      if ((flag.hidden && !config.all)) return;
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

  const text = new TextEncoder();

  await Deno.stdout.write(text.encode(
    JSON.stringify(
      {
        "zcli": "1.0.0",
        commands: [generateCommand(command)],
      },
      null,
      2,
    ) + "\n",
  ));
}
