// deno-lint-ignore-file no-explicit-any
import { path } from "./deps.ts";
import { Command } from "./command.ts";
import { CommandFactory } from "./init.ts";
import { dedent } from "./lib/dedent.ts";
import {
  ZcliJson,
  zcliJson,
  ZcliJsonArgument,
  ZcliJsonCommand,
  ZcliJsonFlag,
} from "./zcli-json.ts";
import { colors } from "./fmt.ts";

export async function zcliDoc<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(
  commandFactory: CommandFactory<Context, any>,
  root: Command<any, any, any>,
  config: ZcliDocConfig = {},
) {
  const json = await zcliJson(commandFactory, root);

  if (!config.output) {
    console.log(toMarkdown(json, config));
  } else {
    const outputDir = path.dirname(config.output);

    try {
      Deno.statSync(outputDir);
    } catch (_err) {
      await Deno.mkdir(outputDir, { recursive: true });
    }

    await Deno.writeTextFile(config.output, toMarkdown(json, config));
  }
}

function toMarkdown(
  json: ZcliJson,
  config: ZcliDocConfig,
) {
  return `${config.title ? `# ${config.title}` : ""}

${config.description ? [...dedent(config.description)].join("\n") : ""}

## Available Commands

| Command | Description |
| ------- | ----------- |
${tableOfContents(json.commands[0], [], config)} 

${commandToMarkdown(json.commands[0], [], config).trim()}`.trim();
}

function tableOfContents(
  command: ZcliJsonCommand,
  path: string[],
  config: ZcliDocConfig,
): string {
  const name = [...path, command.name].join(" ");

  return `
| [**\`${name}\`**](#${formatMarkdownHeaderFragment(`$ ${name}`)}) | ${
    (colors.stripColor(command.summary || command.description)).replace(
      "\n",
      " ",
    )
  } |
${
    command.commands.filter(ignoreFilter(config, path)).map((cmd) =>
      tableOfContents(cmd, [...path, command.name], config)
    )
      .join("\n")
  }
`.trim();
}

/**
 * Remove non-ASCII characters from a string
 *
 * @param fragment - Text to format
 */
function formatMarkdownHeaderFragment(fragment: string) {
  return fragment
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s/g, "-")
    .toLowerCase();
}

function commandToMarkdown(
  command: ZcliJsonCommand,
  path: string[],
  config: ZcliDocConfig,
): string {
  const { name, description, summary, arguments: args, flags } = command;
  const localFlags = flags.filter((flag) => !flag.global);
  const globalFlags = flags.filter((flag) => flag.global);

  return `
---

## \`$ ${[...path, name].join(" ")}\`

${colors.stripColor(description || summary)}

${
    !args?.items.length ? "" : `
### Arguments

${colors.stripColor(args.description || args.summary || "")}

| Type | Variadic? |  Description |
| ---- | --------- | ------------ |
${args.items.map(argumentToMarkdown).join("\n")}
`
  }
${
    !localFlags.length ? "" : `
### Flags

| Name | Type | Required? | Default |  Description |
| -------- | ---- | --------- | --- | --- | 
${localFlags.map(flagToMarkdown).join("\n")}
`
  }
  ${
    !globalFlags.length ? "" : `
### Global Flags

These flags are available on all commands.

| Name | Type | Required? | Default |  Description |
| -------- | ---- | --------- | --- | --- |
${globalFlags.map(flagToMarkdown).join("\n")}
`
  }
[**⇗ Back to top**](#available-commands)

${
    command.commands.filter(ignoreFilter(config, path)).map((cmd) =>
      commandToMarkdown(cmd, path.concat(name), config)
    )
      .join("")
  }

`;
}

function ignoreFilter(
  config: ZcliDocConfig,
  path: string[] = [],
) {
  return (cmd: ZcliJsonCommand) => {
    if (typeof config.ignoreCommands === "function") {
      return !config.ignoreCommands(cmd, [...path, cmd.name]);
    }

    const name = [...path, cmd.name].join(" ");
    return !config.ignoreCommands?.includes(name);
  };
}

function flagToMarkdown(flag: ZcliJsonFlag): string {
  const {
    description,
    summary,
    schema,
    required,
    default: defaultValue,
  } = flag;

  return `| ${formatFlagName(flag)} | \`${jsonSchemaToString(schema)}\` | ${
    required ? "Yes" : "No"
  } | ${defaultValue ? `\`${JSON.stringify(defaultValue)}\`` : ""} | ${
    colors.stripColor(description || summary || "").replace("\n", " ")
  } |`;
}

function argumentToMarkdown(arg: ZcliJsonArgument): string {
  return `| \`${jsonSchemaToString(arg.schema)}\` | ${
    arg.variadic ? "Yes" : "No"
  } | ${colors.stripColor(arg.summary).replace("\n", " ")} |`;
}

function formatFlagName(flag: ZcliJsonFlag): string {
  return [flag.name, ...flag.aliases].map((alias) =>
    alias.length === 1 ? `-${alias}` : `--${alias}`
  ).join(", ");
}

/**
 * Convert a JSON schema to a human-readable string
 */
function jsonSchemaToString(schema: any): string {
  if (schema.type === "array") {
    return `${jsonSchemaToString(schema.items)}[]`;
  } else if (schema.enum) {
    return schema.enum.map((e: any) => JSON.stringify(e)).join(" \\| ");
  } else {
    return schema.type + (schema.format ? `(${schema.format})` : "");
  }
}

export type ZcliDocConfig = {
  /**
   * The title of the document
   */
  title?: string;
  /**
   * The description of the document
   */
  description?: string;
  /**
   * Output the markdown to a file at the given path
   */
  output?: string;
  /**
   * Ignore these commands
   */
  ignoreCommands?:
    | string[]
    | ((command: ZcliJsonCommand, path: string[]) => boolean);
};
