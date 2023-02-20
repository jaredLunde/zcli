// deno-lint-ignore-file no-explicit-any
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

export async function zcliDoc<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(
  commandFactory: CommandFactory<Context, any>,
  root: Command<any, any, any>,
  config: {
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
  } = {},
) {
  const json = await zcliJson(commandFactory, root);

  if (!config.output) {
    console.log(toMarkdown(json));
  } else {
    await Deno.writeTextFile(config.output, toMarkdown(json, config));
  }
}

function toMarkdown(
  json: ZcliJson,
  options: { title?: string; description?: string } = {},
) {
  return `${options.title ? `# ${options.title}` : ""}

${options.description ? [...dedent(options.description)].join("\n") : ""}

## Available Commands

| Command | Description |
| ------- | ----------- |
${tableOfContents(json.commands[0])} 

${commandToMarkdown(json.commands[0]).trim()}`.trim();
}

function tableOfContents(
  command: ZcliJsonCommand,
  path: string[] = [],
): string {
  const name = [...path, command.name].join(" ");

  return `
| [\`${name}\`](#${formatMarkdownHeaderFragment(`$ ${name}`)}) | ${
    (command.summary || command.description).replace("\n", " ")
  } |
${
    command.commands.map((cmd) => tableOfContents(cmd, [...path, command.name]))
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
  path: string[] = [],
): string {
  const { name, description, summary, arguments: args, flags } = command;

  return `
## \`$ ${[...path, name].join(" ")}\`

${description || summary}

${
    !args?.items.length ? "" : `
### Arguments

${args.description || args.summary || ""}

| Type | Variadic? |  Description |
| ---- | --------- | ------------ |
${args.items.map(argumentToMarkdown).join("\n")}
`
  }
${
    !flags.length ? "" : `
### Flags

| Name | Type | Required? | Collects? | Default |  Description |
| -------- | ---- | --------- | --- | --- | ------------ |
${flags.map(flagToMarkdown).join("\n")}
${
      command.commands.map((cmd) => commandToMarkdown(cmd, path.concat(name)))
        .join("")
    }
`
  }
`;
}

function flagToMarkdown(flag: ZcliJsonFlag): string {
  const {
    description,
    summary,
    schema,
    required,
    collects,
    default: defaultValue,
  } = flag;

  return `| ${formatFlagName(flag)} | \`${jsonSchemaToString(schema)}\` | ${
    required ? "Yes" : "No"
  } | ${collects ? "Yes" : "No"} | ${
    defaultValue ? `\`${JSON.stringify(defaultValue)}\`` : ""
  } | ${(description || summary || "").replace("\n", " ")} |`;
}

function argumentToMarkdown(arg: ZcliJsonArgument): string {
  return `| \`${jsonSchemaToString(arg.schema)}\` | ${
    arg.variadic ? "Yes" : "No"
  } | ${arg.summary.replace("\n", " ")} |`;
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
