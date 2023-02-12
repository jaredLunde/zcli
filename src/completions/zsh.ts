// deno-lint-ignore-file no-explicit-any
import { Arg } from "../args.ts";
import { Flag, walkFlags } from "../flags.ts";
import { Command } from "../command.ts";
import { GenericCmd, replaceSpecialChars } from "./shared.ts";
import { shorten } from "../lib/shorten.ts";
import { z } from "../z.ts";

interface ICompletionAction {
  arg: Arg<any, any>;
  label: string;
  name: string;
  cmd: string;
}

export function complete(cmd: GenericCmd) {
  const actions: Map<string, ICompletionAction> = new Map();
  const name = cmd.name;

  function generateCompletions(command: GenericCmd, path = ""): string {
    path = (path ? path + " " : "") + command.name;

    return (
      `# shellcheck disable=SC2154
(( $+functions[_${replaceSpecialChars(path)}] )) ||
function _${replaceSpecialChars(path)}() {` +
      (!path
        ? `
  local state`
        : "") +
      generateCommandCompletions(command, path) +
      generateSubCommandCompletions(command, path) +
      generateArgumentCompletions(command, path) +
      generateActions(command) +
      `\n}\n\n` +
      command.cmds
        .map((subCommand) => generateCompletions(subCommand as any, path))
        .join("")
    );
  }

  function generateCommandCompletions(
    command: GenericCmd,
    path: string
  ): string {
    const commands = command.cmds;

    let completions: string = commands
      .map(
        (subCommand) =>
          `'${subCommand.name}:${shorten(subCommand.description ?? "")
            // escape single quotes
            .replace(/'/g, "'\"'\"'")}'`
      )
      .join("\n      ");

    if (completions) {
      completions = `
    local -a commands
    # shellcheck disable=SC2034
    commands=(
      ${completions}
    )
    _describe 'command' commands`;
    }

    // only complete first argument, rest arguments are completed with _arguments.
    const args = command.args;
    const hasOptionalArgs =
      args instanceof z.ZodOptional || args instanceof z.ZodDefault;
    const hasArgs = args instanceof z.ZodTuple || hasOptionalArgs;

    if (hasArgs) {
      const argsItems =
        hasOptionalArgs && args._def.innerType instanceof z.ZodTuple
          ? args._def.innerType.items
          : args instanceof z.ZodTuple
          ? args.items
          : [];
      const completionsPath: string = path.split(" ").slice(1).join(" ");
      const arg = argsItems[0];
      const action = addAction(arg, completionsPath);
      if (action) {
        completions += `\n    __${replaceSpecialChars(cmd.name)}_complete ${
          action.arg.name
        } ${action.arg.action} ${action.cmd}`;
      }
    }

    if (completions) {
      completions = `\n\n  function _commands() {${completions}\n  }`;
    }

    return completions;
  }

  function generateArgumentCompletions(
    command: GenericCmd,
    path: string
  ): string {
    /* clear actions from previously parsed command. */
    actions.clear();

    const options: string[] = generateOptions(command, path);

    let argIndex = 0;
    // @TODO: add stop early option: -A "-*"
    // http://zsh.sourceforge.net/Doc/Release/Completion-System.html
    let argsCommand = "\n\n  _arguments -w -s -S -C";
    argsCommand += ` \\\n    ${options.join(" \\\n    ")}`;

    if (command.cmds.length) {
      argsCommand += ` \\\n    '${++argIndex}:command:_commands'`;
    }

    if (command.hasArguments() || command.hasCommands(false)) {
      const args: string[] = [];

      // first argument is completed together with commands.
      for (const arg of command.getArguments().slice(1)) {
        const completionsPath: string = path.split(" ").slice(1).join(" ");
        const action = this.addAction(arg, completionsPath);
        args.push(
          `${++argIndex}${arg.optional ? "::" : ":"}${arg.name}:->${
            action.name
          }`
        );
      }

      argsCommand += args.map((arg: string) => `\\\n    '${arg}'`).join("");

      if (command.cmds.length) {
        argsCommand += ` \\\n    '*::sub command:->command_args'`;
      }
    }

    return argsCommand;
  }

  function generateSubCommandCompletions(
    command: Command,
    path: string
  ): string {
    if (command.hasCommands(false)) {
      const actions: string = command
        .getCommands(false)
        .map(
          (command: Command) =>
            `${command.getName()}) _${replaceSpecialChars(
              path + " " + command.getName()
            )} ;;`
        )
        .join("\n      ");

      return `\n
  function _command_args() {
    case "\${words[1]}" in\n      ${actions}\n    esac
  }`;
    }

    return "";
  }

  function generateOptions(command: Command, path: string) {
    const options: string[] = [];
    const cmdArgs: string[] = path.split(" ");
    const _baseName: string = cmdArgs.shift() as string;
    const completionsPath: string = cmdArgs.join(" ");

    const excludedFlags: string[] = command
      .getOptions(false)
      .map((option) => (option.standalone ? option.flags : false))
      .flat()
      .filter((flag) => typeof flag === "string") as string[];

    for (const option of command.getOptions(false)) {
      options.push(
        this.generateOption(command, option, completionsPath, excludedFlags)
      );
    }

    return options;
  }

  function generateOption(
    command: Command,
    option: Option,
    completionsPath: string,
    excludedOptions: string[]
  ): string {
    let args = "";
    for (const arg of option.args) {
      const type = command.getType(arg.type);
      const optionalValue = arg.optional ? "::" : ":";
      if (type && type.handler instanceof FileType) {
        const fileCompletions = this.getFileCompletions(type);
        args += `${optionalValue}${arg.name}:${fileCompletions}`;
      } else {
        const action = this.addAction(arg, completionsPath);
        args += `${optionalValue}${arg.name}:->${action.name}`;
      }
    }
    const description: string = getDescription(option.description, true)
      // escape brackets and quotes
      .replace(/\[/g, "\\[")
      .replace(/]/g, "\\]")
      .replace(/"/g, '\\"')
      .replace(/'/g, "'\"'\"'");

    const collect: string = option.collect ? "*" : "";
    const equalsSign = option.equalsSign ? "=" : "";
    const flags = option.flags.map((flag) => `${flag}${equalsSign}`);
    let result = "";

    if (option.standalone) {
      result += "'(- *)'";
    } else {
      const excludedFlags = [...excludedOptions];

      if (option.conflicts?.length) {
        excludedFlags.push(
          ...option.conflicts.map((opt) => "--" + opt.replace(/^--/, ""))
        );
      }
      if (!option.collect) {
        excludedFlags.push(...option.flags);
      }
      if (excludedFlags.length) {
        result += `'(${excludedFlags.join(" ")})'`;
      }
    }

    if (collect || flags.length > 1) {
      result += `{${collect}${flags.join(",")}}`;
    } else {
      result += `${flags.join(",")}`;
    }

    return `${result}'[${description}]${args}'`;
  }

  function addAction(arg: Argument, cmd: string): ICompletionAction {
    const action = `${arg.name}-${arg.action}`;

    if (!actions.has(action)) {
      actions.set(action, {
        arg: arg,
        label: `${arg.name}: ${arg.action}`,
        name: action,
        cmd,
      });
    }

    return actions.get(action) as ICompletionAction;
  }

  function generateActions(command: Command): string {
    let actions_: string[] = [];

    if (actions.size) {
      actions_ = Array.from(actions).map(
        ([name, action]) =>
          `${name}) __${replaceSpecialChars(cmd.name)}_complete ${
            action.arg.name
          } ${action.arg.action} ${action.cmd} ;;`
      );
    }

    if (command.hasCommands(false)) {
      actions_.unshift(`command_args) _command_args ;;`);
    }

    if (actions_.length) {
      return `\n\n  case "$state" in\n    ${actions_.join("\n    ")}\n  esac`;
    }

    return "";
  }

  return `#!/usr/bin/env zsh
autoload -U is-at-least
# shellcheck disable=SC2154
(( $+functions[__${replaceSpecialChars(name)}_complete] )) ||
function __${replaceSpecialChars(name)}_complete {
  local name="$1"; shift
  local action="$1"; shift
  integer ret=1
  local -a values
  local expl lines
  _tags "$name"
  while _tags; do
    if _requested "$name"; then
      # shellcheck disable=SC2034
      lines="$(${name} completions complete "\${action}" "\${@}")"
      values=("\${(ps:\\n:)lines}")
      if (( \${#values[@]} )); then
        while _next_label "$name" expl "$action"; do
          compadd -S '' "\${expl[@]}" "\${values[@]}"
        done
      fi
    fi
  done
}
${generateCompletions(cmd).trim()}
# _${replaceSpecialChars(name)} "\${@}"
compdef _${replaceSpecialChars(name)} ${name}`;
}
