import { typeAsString, walkFlags } from "../flags.ts";
import { escapeString, GenericCommand } from "./shared.ts";
import { shorten } from "../lib/shorten.ts";
import { z } from "../z.ts";
import { walkArgs } from "../args.ts";

export function complete(command: GenericCommand) {
  const name = escapeString(command.name);
  const fnNames: string[] = [];
  const stack: [GenericCommand, string[]][] = [[command, []]];

  while (stack.length > 0) {
    const [cmd, path] = stack.pop()!;
    fnNames.push(`__${[...path, cmd.name].join("_")}`);
    // @ts-expect-error: it's fine
    stack.push(...cmd.commands.map((c) => [c, [...path, cmd.name]]));
  }

  return `#!/usr/bin/env fish

function __fish_${name}_using_command
  set -l cmds ${fnNames.join(" ")}
  set -l words (commandline -opc)
  set -l cmd "_"

  for word in $words
    switch $word
      case '-*'
        continue
      case '*'
        set word (string replace -r -a '\W' '_' $word)
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

${completeCommand(command, [])}
`;
}

function completeCommand(command: GenericCommand, path: string[]) {
  const name = escapeString(command.name);
  path = [...path, name];
  const fnName = `__${path.join("_")}`;
  const completions: string[] = [];
  const hasOptionalArgs = command.args instanceof z.ZodOptional ||
    command.args instanceof z.ZodDefault;

  if (path.length > 1) {
    completions.push(
      `complete -c ${path[0]} -n '__fish_${
        path[0]
      }_not_in_command ${fnName}' -k -f -a ${command.name} -d '${
        (
          command.description ?? shorten(command.longDescription ?? "")
        ).replace(/'/g, "\\'")
      }'`,
    );
  }

  walkArgs(command.args, (arg, { position }) => {
    // TODO: handle variadic args
    if (position > 0) {
      return;
    }

    const completion: string[] = [
      `complete -c ${path[0]} -n '__fish_${path[0]}_using_command ${fnName}'`,
    ];

    if (!hasOptionalArgs) {
      completion.push("-r");
    }

    completion.push("-k -f -a");

    if (arg.description || arg.longDescription) {
      completion.push(
        `-d '${
          (arg.description ?? shorten(arg.longDescription ?? "")).replace(
            /'/g,
            "\\'",
          )
        }'`,
      );
    }

    completions.push(completion.join(" "));
  });

  walkFlags(command.flags, (flag, name) => {
    if (flag.hidden) {
      return;
    }

    const type = typeAsString(flag);
    const completion: string[] = [
      `complete -c ${path[0]} -n '__fish_${path[0]}_using_command ${fnName}'`,
    ];

    if (flag.aliases.length > 0) {
      completion.push(`-s ${flag.aliases[0]}`);
    }

    completion.push(`-l ${name}`);

    if (type === "boolean") {
      completion.push("-x");
    }

    if (!(flag instanceof z.ZodOptional) && !(flag instanceof z.ZodDefault)) {
      completion.push("-r");
    }

    completion.push("-k -f");

    if (flag.description || flag.longDescription) {
      completion.push(
        `-d '${
          (
            flag.description ?? shorten(flag.longDescription ?? "")
          ).replace(/'/g, "\\'")
        }'`,
      );
    }

    completions.push(completion.join(" "));
  });

  for (const cmd of command.commands) {
    if (!cmd.hidden) {
      completions.push("\n" + completeCommand(cmd, path));
    }
  }

  return `# ${path.join(" ")} \n${completions.join("\n")}`;
}
