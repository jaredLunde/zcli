import { walkArgs } from "../args.ts";
import { innerType, typeAsString, walkFlags } from "../flags.ts";
import { escapeString, GenericCommand } from "./shared.ts";
import { z } from "../z.ts";

export function complete(
  command: GenericCommand,
  options: { disableDescriptions?: boolean } = {},
) {
  return [
    `#compdef _${command.name} ${[command.name, ...command.aliases].join(" ")}`,
    completeCommand(command, [], options),
  ].join("\n".repeat(2));
}

function completeCommand(
  command: GenericCommand,
  path: string[] = [],
  options: { disableDescriptions?: boolean } = {},
): string {
  const name = `_${[...path, escapeString(command.name)].join("_")}`;
  let functionBody = "";

  if (command.commands.length && !command.args) {
    functionBody = completeCommands(command, [
      ...path,
      escapeString(command.name),
    ], options);
  } else {
    functionBody = completeArgsAndFlags(command, options);
  }

  const subCommands = command.commands
    .map((subCommand) =>
      completeCommand(
        subCommand,
        [...path, escapeString(command.name)],
        options,
      )
    )
    .join("\n\n");

  return `
function ${name} {
  ${functionBody}
}

${subCommands}
`.trim();
}

function completeCommands<T extends GenericCommand>(
  command: T,
  path: string[] = [],
  options: { disableDescriptions?: boolean } = {},
) {
  const indent = " ".repeat(10);
  const subCommands = command.commands
    .filter((subCommand) => !subCommand.hidden)
    .map((subCommand) => {
      return [
        " ".repeat(8),
        `${subCommand.name})`,
        `\n${indent}`,
        `_${[...path, escapeString(subCommand.name)].join("_")}`,
        `\n${indent};;`,
      ].join("");
    })
    .join(`\n`);

  return `
  local line state
  local -a commands

  _arguments -s -C \\
    "1: :->command" \\
    "*::arg:->args" \\
    ${completeFlags(command, options).join(" \\\n" + " ".repeat(4))}

  case $state in
    command)
      commands=(
        ${
    command.commands
      .map((command) => {
        const name = escapeString(command.name);
        const description = options.disableDescriptions
          ? ""
          : (command.description ?? "").replace(":", " ");
        return `"${name}:${description}"`;
      })
      .join(`\n${" ".repeat(8)}`)
  }
      )
      _describe "command" commands
      ;;

    args)
      case $line[1] in
${subCommands}
      esac
      ;;
  esac
`.trim();
}

function completeArgsAndFlags(
  command: GenericCommand,
  options: { disableDescriptions?: boolean } = {},
) {
  const args = completeArgs(command, options);
  const flags = completeFlags(command, options);

  if (args.length > 0 || flags.length > 0) {
    const indent = " ".repeat(4);

    return [
      `_arguments -s \\\n${indent}`,
      [...args, ...flags].join(` \\\n${indent}`),
    ].join("");
  }

  return "";
}

function completeArgs(
  command: GenericCommand,
  options: { disableDescriptions?: boolean } = {},
): string[] {
  const args: string[] = [];
  const hasOptionalArgs = command.args instanceof z.ZodOptional ||
    command.args instanceof z.ZodDefault;

  walkArgs(command.args, (arg, { position, variadic }) => {
    const message =
      ((options.disableDescriptions ? "" : arg.description) || arg.name)
        .replace(":", " ");
    let action = ``;
    // A zsh variadic argument
    const variadicPrefix = variadic ? "*" : " ";
    const type = innerType(arg);

    if (type instanceof z.ZodEnum || type instanceof z.ZodNativeEnum) {
      action = `(${type._def.values.map((v: unknown) => `"${v}"`).join(" ")})`;
    } else if (type instanceof z.ZodLiteral) {
      action = `(${JSON.stringify(type._def.value)})`;
    } else if (!hasOptionalArgs) {
      action = `( )`;
    }

    args.push(
      `"${variadicPrefix ? "*" : ""}${
        !variadicPrefix ||
          hasOptionalArgs ||
          arg instanceof z.ZodOptional ||
          arg instanceof z.ZodDefault
          ? ":"
          : position + 1
      }:${message}:${action}"`,
    );
  });

  return args;
}

function completeFlags(
  command: GenericCommand,
  options: { disableDescriptions?: boolean } = {},
): string[] {
  const args: string[] = [];

  walkFlags(command.flags, (flag, name) => {
    if (flag.hidden) {
      return;
    }

    let group: string | null = null;
    const optname: {
      long: string;
      neg?: string;
      short?: string;
    } = {
      long: `--${name}`,
    };

    if (flag.aliases.length) {
      optname.short = `-${flag.aliases.join(" -")}`;
    }

    if (flag.negatable) {
      optname.neg = `--no-${name}`;
    }

    const typeName = typeAsString(flag);

    if (typeName !== "boolean" && name !== "help") {
      optname.long = `${optname.long}=`;

      if (optname.short) {
        optname.short = `${optname.short}+`;
      }

      if (typeName === "array") {
        // Until the Upstream PR is merged, everything is multiple 🤷‍♂️
        optname.long = `*${optname.long}`;

        if (optname.short) {
          optname.short = `*${optname.short}`;
        }
      } else if (optname.short) {
        group = `(${Object.values(optname).filter(Boolean).join(" ")})`;
      }
    }

    const optspec: string[] = [];

    if (group) {
      optspec.push(`{${Object.values(optname).filter(Boolean).join(",")}}`);
    } else {
      optspec.push(`${optname.long}`);

      if (optname.short) {
        optspec.push(`${optname.short}`);
      }
    }

    const explanation = `[${
      ((options.disableDescriptions ? "" : flag.description) ?? "").replace(
        ":",
        " ",
      )
    }]`;
    const message = `${name}`;
    let action = ``;

    if (
      innerType instanceof z.ZodEnum ||
      innerType instanceof z.ZodNativeEnum
    ) {
      action = `(${flag._def.values.join(" ")})`;
    } else if (
      !(flag instanceof z.ZodOptional) &&
      !(flag instanceof z.ZodDefault)
    ) {
      action = `( )`;
    }

    let optarg = ``;

    if (typeName !== "boolean" && name !== "help") {
      optarg = `:${message}:${action}`;
    }

    if (group) {
      args.push(`"${group}"${optspec}"${explanation}${optarg}"`);
    } else {
      args.push(
        ...optspec.map((optspec) => `"${optspec}${explanation}${optarg}"`),
      );
    }
  });

  return args;
}
