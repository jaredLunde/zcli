// deno-lint-ignore-file no-explicit-any
import { walkFlags } from "../flags.ts";
import { GenericArg, GenericCmd, replaceSpecialChars } from "./shared.ts";
import { z } from "../z.ts";

export function complete<Cmd extends GenericCmd>(cmd: Cmd) {
  const path = cmd.name;

  function generateCompletions(
    command: GenericCmd,
    path = "",
    index = 1,
  ): string {
    path = (path ? path + " " : "") + command.name;

    const commandCompletions = generateCommandCompletions(command, path, index);
    const childCommandCompletions: string = command.commands
      .map((subCommand) =>
        generateCompletions(subCommand as any, path, index + 1)
      )
      .join("");

    return `${commandCompletions}
${childCommandCompletions}`;
  }

  function generateCommandCompletions(
    command: GenericCmd,
    path: string,
    index: number,
  ): string {
    const flags: string[] = getFlags(command);
    const childCommandNames: string[] = command.commands.map(
      (childCommand) => childCommand.name,
    );
    const completionsPath: string = ~path.indexOf(" ")
      ? " " + path.split(" ").slice(1).join(" ")
      : "";

    const optionArguments = generateOptionArguments(command, completionsPath);

    const completionsCmd = generateCommandCompletionsCommand(
      command,
      completionsPath,
    );

    return `  __${replaceSpecialChars(path)}() {
    opts=(${[...flags, ...childCommandNames].join(" ")})
    ${completionsCmd}
    if [[ \${cur} == -* || \${COMP_CWORD} -eq ${index} ]] ; then
      return 0
    fi
    ${optionArguments}
  }`;
  }

  function generateOptionArguments(
    command: GenericCmd,
    completionsPath: string,
  ): string {
    let opts = "";
    const options = command.flags;
    walkFlags(options, (option, name) => {
      opts += 'case "${prev}" in';
      const flags: string = [name, ...option.aliases]
        .map((flag: string) => flag.trim())
        .join("|");

      const completionsCmd = generateOptionCompletionsCommand(
        command,
        [],
        completionsPath,
      );

      opts += `\n      ${flags}) ${completionsCmd} ;;`;
    });

    opts += "\n    esac";
    return opts;
  }

  function getFlags(command: GenericCmd): string[] {
    const flags: string[] = [];

    walkFlags(command.flags, (option, name) => {
      flags.push(name);
      flags.push(...option.aliases);
    });

    return flags;
  }

  function generateCommandCompletionsCommand(
    command: GenericCmd,
    path: string,
  ) {
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

      // @TODO: add support for multiple arguments
      return `_${replaceSpecialChars(command.name)}_complete ${
        argsItems[0].name
      }${path}`;
    }

    return "";
  }

  function generateOptionCompletionsCommand(
    command: GenericCmd,
    args: GenericArg[],
    path: string,
  ) {
    if (args.length) {
      // @TODO: add support for multiple arguments
      return `opts=(); _${replaceSpecialChars(command.name)}_complete ${
        args[0].name
      }${path}`;
    }

    return "";
  }

  return `#!/usr/bin/env bash
_${replaceSpecialChars(path)}() {
  local word cur prev listFiles
  local -a opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cmd="_"
  opts=()
  listFiles=0
  _${replaceSpecialChars(cmd.name)}_complete() {
    local action="$1"; shift
    mapfile -t values < <( ${cmd.name} completions complete "\${action}" "\${@}" )
    for i in "\${values[@]}"; do
      opts+=("$i")
    done
  }
  _${replaceSpecialChars(cmd.name)}_expand() {
    [ "$cur" != "\${cur%\\\\}" ] && cur="$cur\\\\"
  
    # expand ~username type directory specifications
    if [[ "$cur" == \\~*/* ]]; then
      # shellcheck disable=SC2086
      eval cur=$cur
      
    elif [[ "$cur" == \\~* ]]; then
      cur=\${cur#\\~}
      # shellcheck disable=SC2086,SC2207
      COMPREPLY=( $( compgen -P '~' -u $cur ) )
      return \${#COMPREPLY[@]}
    fi
  }
  # shellcheck disable=SC2120
  _${replaceSpecialChars(cmd.name)}_file_dir() {
    listFiles=1
    local IFS=$'\\t\\n' xspec #glob
    _${replaceSpecialChars(cmd.name)}_expand || return 0
  
    if [ "\${1:-}" = -d ]; then
      # shellcheck disable=SC2206,SC2207,SC2086
      COMPREPLY=( \${COMPREPLY[@]:-} $( compgen -d -- $cur ) )
      #eval "$glob"    # restore glob setting.
      return 0
    fi
  
    xspec=\${1:+"!*.$1"}	# set only if glob passed in as $1
    # shellcheck disable=SC2206,SC2207
    COMPREPLY=( \${COMPREPLY[@]:-} $( compgen -f -X "$xspec" -- "$cur" ) \
          $( compgen -d -- "$cur" ) )
  }
  ${generateCompletions(cmd).trim()}
  for word in "\${COMP_WORDS[@]}"; do
    case "\${word}" in
      -*) ;;
      *)
        cmd_tmp="\${cmd}_\${word//[^[:alnum:]]/_}"
        if type "\${cmd_tmp}" &>/dev/null; then
          cmd="\${cmd_tmp}"
        fi
    esac
  done
  \${cmd}
  if [[ listFiles -eq 1 ]]; then
    return 0
  fi
  if [[ \${#opts[@]} -eq 0 ]]; then
    # shellcheck disable=SC2207
    COMPREPLY=($(compgen -f "\${cur}"))
    return 0
  fi
  local values
  values="$( printf "\\n%s" "\${opts[@]}" )"
  local IFS=$'\\n'
  # shellcheck disable=SC2207
  local result=($(compgen -W "\${values[@]}" -- "\${cur}"))
  if [[ \${#result[@]} -eq 0 ]]; then
    # shellcheck disable=SC2207
    COMPREPLY=($(compgen -f "\${cur}"))
  else
    # shellcheck disable=SC2207
    COMPREPLY=($(printf '%q\\n' "\${result[@]}"))
  fi
  return 0
}
complete -F _${replaceSpecialChars(path)} -o bashdefault -o default ${path}`;
}
