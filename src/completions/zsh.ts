import { walkArgs } from "../args.ts";
import { innerType, typeAsString, walkFlags } from "../flags.ts";
import { escapeString, GenericCommand } from "./shared.ts";
import { z } from "../z.ts";

export function complete<T extends GenericCommand>(command: T) {
  return `
#compdef _${command.name} ${[command.name, ...command.aliases].join(" ")}

${completeCommand(command)}
`.trim();
}

function completeCommand<T extends GenericCommand>(
  command: T,
  path = "",
): string {
  const name = `${path}_${escapeString(command.name)}`;

  let functionBody = "";

  if (command.commands.length && !command.args) {
    functionBody = completeCommands(command, name);
  } else {
    functionBody = completeArgsAndFlags(command);
  }

  const subcommands = command.commands
    .map((subCommand) => completeCommand(subCommand, name))
    .join("\n\n");
  return `
function ${name} {
  ${functionBody}
}

${subcommands}
`.trim();
}

function completeCommands<T extends GenericCommand>(command: T, path = "") {
  return `
  local line state
  local -a commands

  _arguments -s -C \\
    "1: :->command" \\
    "*::arg:->args" \\
    ${completeFlags(command).join(` \\\n${" ".repeat(4)}`)}

  case $state in
    command)
      commands=(
        ${
    command.commands
      .map((command) => {
        const NAME = escapeString(command.name);
        const DESCRIPTION = (command.description ?? "").replace(":", " ");
        return `"${NAME}:${DESCRIPTION}"`;
      })
      .join(`\n${" ".repeat(8)}`)
  }
      )
      _describe "command" commands
      ;;

    args)
      case $line[1] in
${
    command.commands
      .map((subCommand) => {
        return `${" ".repeat(8)}${subCommand.name})
${" ".repeat(10)}${path}_${escapeString(subCommand.name)}\n${" ".repeat(10)};;`;
      })
      .join(`\n`)
  }
      esac
      ;;
  esac
`.trim();
}

function completeArgsAndFlags(command: GenericCommand) {
  const args = completeArgs(command);
  const flags = completeFlags(command);

  if (args.length > 0 || flags.length > 0) {
    return `_arguments -s \\\n${" ".repeat(4)}${
      [...args, ...flags].join(
        ` \\\n${" ".repeat(4)}`,
      )
    }`;
  }

  return "";
}

function completeArgs<T extends GenericCommand>(command: T): string[] {
  const args: string[] = [];
  const hasOptionalArgs = command.args instanceof z.ZodOptional ||
    command.args instanceof z.ZodDefault;

  walkArgs(command.args, (arg, { position, variadic }) => {
    const MESSAGE = (arg.description ?? arg.name).replace(":", " ");
    let ACTION = ``;
    // A zsh variadic argument
    const VARIADIC = variadic ? "*" : " ";
    const type = innerType(arg);

    if (type instanceof z.ZodEnum || type instanceof z.ZodNativeEnum) {
      ACTION = `(${type._def.values.join(" ")})`;
    } else if (type instanceof z.ZodLiteral) {
      ACTION = `(${type._def.value}${VARIADIC})`;
    } else if (!hasOptionalArgs) {
      ACTION = `( )`;
    }

    args.push(
      `"${variadic ? "*" : ""}${
        hasOptionalArgs ||
          arg instanceof z.ZodOptional ||
          arg instanceof z.ZodDefault
          ? ":"
          : position + 1
      }:${MESSAGE}:${ACTION}"`,
    );
  });

  return args;
}

function completeFlags<T extends GenericCommand>(command: T): string[] {
  const args: string[] = [];

  walkFlags(command.flags, (flag, name) => {
    let GROUP: string | null = null;
    const OPTNAME: {
      long: string;
      neg?: string;
      short?: string;
    } = {
      long: `--${name}`,
    };

    if (flag.aliases.length) {
      OPTNAME.short = `-${flag.aliases.join(" -")}`;
    }

    if (flag.negatable) {
      OPTNAME.neg = `--no-${name}`;
    }

    const typeName = typeAsString(flag);

    if (typeName !== "boolean" && name !== "help") {
      OPTNAME.long = `${OPTNAME.long}=`;

      if (OPTNAME.short) {
        OPTNAME.short = `${OPTNAME.short}+`;
      }

      if (typeName === "array") {
        // Until the Upstream PR is merged, everything is multiple 🤷‍♂️
        OPTNAME.long = `*${OPTNAME.long}`;

        if (OPTNAME.short) {
          OPTNAME.short = `*${OPTNAME.short}`;
        }
      } else if (OPTNAME.short) {
        GROUP = `(${Object.values(OPTNAME).filter(Boolean).join(" ")})`;
      }
    }

    const OPTSPEC: string[] = [];

    if (GROUP) {
      OPTSPEC.push(`{${Object.values(OPTNAME).filter(Boolean).join(",")}}`);
    } else {
      OPTSPEC.push(`${OPTNAME.long}`);

      if (OPTNAME.short) {
        OPTSPEC.push(`${OPTNAME.short}`);
      }
    }

    const EXPLANATION = `[${(flag.description ?? "").replace(":", " ")}]`;

    const MESSAGE = `${name}`;

    let ACTION = ``;

    if (
      innerType instanceof z.ZodEnum ||
      innerType instanceof z.ZodNativeEnum
    ) {
      ACTION = `(${flag._def.values.join(" ")})`;
    } else if (
      !(flag instanceof z.ZodOptional) &&
      !(flag instanceof z.ZodDefault)
    ) {
      ACTION = `( )`;
    }

    let OPTARG = ``;

    if (typeName !== "boolean" && name !== "help") {
      OPTARG = `:${MESSAGE}:${ACTION}`;
    }

    if (GROUP) {
      args.push(`"${GROUP}"${OPTSPEC}"${EXPLANATION}${OPTARG}"`);
    } else {
      args.push(
        ...OPTSPEC.map((optspec) => `"${optspec}${EXPLANATION}${OPTARG}"`),
      );
    }
  });

  return args;
}
