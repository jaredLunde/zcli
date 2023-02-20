// deno-lint-ignore-file no-explicit-any
import { Command } from "./command.ts";
import { CommandFactory } from "./init.ts";
import {
  ZcliJson,
  zcliJson,
  ZcliJsonArgument,
  ZcliJsonCommand,
  ZcliJsonFlag,
} from "./zcli-json.ts";

export async function zcliDocs<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(commandFactory: CommandFactory<Context, any>, root: Command<any, any, any>) {
  const json = await zcliJson(commandFactory, root);
  console.log(toMarkdown(json));
}

function toMarkdown(json: ZcliJson) {
  const markdown = `
# ${json.info.name} v${json.info.version}

${commandToMarkdown(json.commands[0])}
`;

  return markdown;
}

function commandToMarkdown(command: ZcliJsonCommand) {
  const { name, description, summary, arguments: args, flags } = command;

  return `
## \`$ ${name}\`

${description || summary}

${
    !!args?.items.length && `
### Arguments

${args.description || args.summary}

| Type | Variadic? |  Description |
| ---- | --------- | ------------ |
${args.items.map(argumentToMarkdown).join("\n")}
`
  }
${
    flags.length && `
### Flags

| Name | Type | Required? | Collects? | Default |  Description |
| -------- | ---- | --------- | --- | --- | ------------ |
${flags.map(flagToMarkdown).join("\n")}
`
  }
`;
}

function flagToMarkdown(flag: ZcliJsonFlag) {
  const {
    name,
    description,
    aliases,
    summary,
    schema,
    required,
    collects,
    default: defaultValue,
  } = flag;

  return `| --${
    name + (aliases ? `, -${aliases.join(", -")}` : "")
  } | \`${schema.type}\` | ${required ? "Yes" : "No"} | ${
    collects ? "Yes" : "No"
  } | ${defaultValue ? `\`${JSON.stringify(defaultValue)}\`` : ""} | ${
    (description || summary || "").replace("\n", " ")
  } |`;
}

function argumentToMarkdown(arg: ZcliJsonArgument) {
  return `| \`${arg.schema.type}\` | ${arg.variadic ? "Yes" : "No"} | ${
    arg.summary.replace("\n", " ")
  } |`;
}
