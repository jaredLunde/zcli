// deno-lint-ignore-file no-explicit-any
import { walkFlags } from "../flags.ts";
import { Arg } from "../args.ts";
import { Command } from "../command.ts";
import { z } from "../z.ts";
import { shorten } from "../lib/shorten.ts";
import { GenericCmd, GenericOpt, replaceSpecialChars } from "./shared.ts";

/**
 * Generates fish completions script.
 */
export function complete(command: GenericCmd): string {
  function generateCompletions(command: GenericCmd, path = ""): string {
    let result = ``;

    const commandName = path ? `${path} ${command.name}` : command.name;

    // arguments
    const args = command.args;
    const hasOptionalArgs = args instanceof z.ZodOptional ||
      args instanceof z.ZodDefault;
    const hasArgs = args instanceof z.ZodTuple || hasOptionalArgs;

    if (hasArgs) {
      const argsItems =
        hasOptionalArgs && args._def.innerType instanceof z.ZodTuple
          ? args._def.innerType.items
          : args instanceof z.ZodTuple
          ? args.items
          : [];

      result += "\n" +
        generate(commandName, {
          arguments: getCompletionCommand(
            command.name,
            commandName,
            argsItems[0],
          ),
        });
    }

    // options
    walkFlags(command.flags, (opt, name) => {
      result += "\n" + completeOption(commandName, name, opt);
    });

    for (const subCommand of command.commands) {
      // @ts-expect-error: whatever
      result += generateCompletions(subCommand, commandName);
    }

    return result;
  }

  function completeOption(
    commandName: string,
    name: string,
    option: GenericOpt,
  ) {
    const shortOption: string | undefined = option.aliases[0];
    const longOption: string | undefined = name;

    return generate(commandName, {
      description: option.description,
      shortOption,
      longOption,
      required: !(
        option instanceof z.ZodOptional || option instanceof z.ZodDefault
      ),
    });
  }

  function generate(commandName: string, options: GenerateOptions = {}) {
    const cmd = ["complete"];
    cmd.push("-c", command.name);
    cmd.push(
      "-n",
      `'__fish_${
        replaceSpecialChars(
          commandName,
        )
      }_using_command __${replaceSpecialChars(commandName)}'`,
    );
    options.shortOption && cmd.push("-s", options.shortOption);
    options.longOption && cmd.push("-l", options.longOption);
    options.standalone && cmd.push("-x");
    cmd.push("-k");
    cmd.push("-f");

    if (options.arguments) {
      options.required && cmd.push("-r");
      cmd.push("-a", options.arguments);
    }

    if (options.description) {
      const description: string = shorten(options.description).replace(
        /'/g,
        "\\'",
      );

      cmd.push("-d", `'${description}'`);
    }

    return cmd.join(" ");
  }

  function getCompletionCommand(
    commandName: string,
    commandPath: string,
    arg: Arg<any, any>,
  ): string {
    return `'(${commandName} completions complete ${
      arg.name + " " + commandPath
    })'`;
  }
  return `#!/usr/bin/env fish

function __fish_${replaceSpecialChars(command.name)}_using_command
  set -l cmds ${getCommandFnNames(command).join(" ")}
  set -l words (commandline -opc)
  set -l cmd "_"
  for word in $words
    switch $word
      case '-*'
        continue
      case '*'
        set word (string replace -r -a '\\W' '_' $word)
        set -l cmd_tmp $cmd"_$word"
        if contains $cmd_tmp $cmds
          set cmd $cmd_tmp
        end
    end
  end
  if test "$cmd" = "$argv[1]"
    return 0
  end
  return 1
end

${generateCompletions(command).trim()}
`;
}

function getCommandFnNames(cmd: GenericCmd): string[] {
  const cmds: string[] = [`__${replaceSpecialChars(cmd.name)}`];
  const stack: [Command<any, any, any, any>, string][] = cmd.commands.map(
    (c) => [c, cmd.name],
  );

  while (stack.length) {
    const [cmd, name] = stack.pop()!;
    const path = `${name} ${cmd.name}`;
    cmds.push(`__${replaceSpecialChars(path)}`);
    stack.push(
      ...cmd.commands.map(
        (c: Command<any, any, any, any>) =>
          [c, path] as [Command<any, any, any, any>, string],
      ),
    );
  }

  return cmds;
}

/** Generates fish completions script. */
interface GenerateOptions {
  description?: string;
  shortOption?: string;
  longOption?: string;
  required?: boolean;
  standalone?: boolean;
  arguments?: string;
}
