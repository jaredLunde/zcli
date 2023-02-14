import { innerType, walkFlags } from "../flags.ts";
import { escapeString, GenericCommand } from "./shared.ts";
import { z } from "../z.ts";

export function complete(command: GenericCommand) {
  const name = escapeString(command.name);

  return `#!/usr/bin/env bash

_${name}() {
  local word cur prev listFiles
  local -a opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cmd="_"
  opts=()
  listFiles=0

  _${name}_expand() {
    [ "$cur" != "\${cur%\\\\}" ] && cur="$cur\\\\"

    # expand ~username type directory specifications
    if [[ "$cur" == \~*/* ]]; then
      # shellcheck disable=SC2086
      eval cur=$cur

    elif [[ "$cur" == \~* ]]; then
      cur=\${cur#\~}
      # shellcheck disable=SC2086,SC2207
      COMPREPLY=( $( compgen -P '~' -u $cur ) )
      return \${#COMPREPLY[@]}
    fi
  }

  # shellcheck disable=SC2120
  _${name}_file_dir() {
    listFiles=1
    local IFS=$'\\t\\n' xspec #glob
    _${name}_expand || return 0

    if [ "\${1:-}" = -d ]; then
      # shellcheck disable=SC2206,SC2207,SC2086
      COMPREPLY=( \${COMPREPLY[@]:-} $( compgen -d -- $cur ) )
      #eval "$glob"    # restore glob setting.
      return 0
    fi

    xspec=\${1:+"!*.$1"}	# set only if glob passed in as $1
    # shellcheck disable=SC2206,SC2207
    COMPREPLY=( \${COMPREPLY[@]:-} $( compgen -f -X "$xspec" -- "$cur" )           $( compgen -d -- "$cur" ) )
  }
  ${completeCommand(command)}

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

complete -F _${name} -o bashdefault -o default ${command.name}`;
}

function completeCommand(command: GenericCommand, path: string[] = []): string {
  const name = [path.join("_"), escapeString(command.name)]
    .filter(Boolean)
    .join("_");
  const opts: string[] = [];
  const cases: string[] = [];

  walkFlags(command.flags, (flag, name) => {
    if (flag.hidden) {
      return;
    }

    const type = innerType(flag);
    const aliases = flag.aliases.map((alias) => `-${alias}`);
    opts.push(...aliases, `--${name}`);
    // TODO: add support for file types
    // if (type && type.handler instanceof FileType) {
    //   return `opts=(); _${replaceSpecialChars(this.cmd.getName())}_file_dir`;
    // }
    // TODO: add support for option completion
    let optDef = "opts=()";

    if (type instanceof z.ZodEnum || type instanceof z.ZodNativeEnum) {
      optDef = `opts=(${type._def.values
        .map((v: string) => `"${v}"`)
        .join(" ")})`;
    } else if (type instanceof z.ZodLiteral) {
      optDef = `opts=(${JSON.stringify(type._def.value)})`;
    }

    cases.push(
      [`${[...aliases, `--${name}`].join("|")})`, optDef, ";;"].join(
        `\n${" ".repeat(8)}`
      )
    );
  });

  const subCommands: string[] = [];

  for (const subCommand of command.commands) {
    if (!subCommand.hidden) {
      opts.push(subCommand.name);
      subCommands.push(
        completeCommand(subCommand, [...path, escapeString(command.name)])
      );
    }
  }

  return `
  __${name}() {
    opts=(${opts.join(" ")})
    
    if [[ \${cur} == -* || \${COMP_CWORD} -eq ${path.length + 1} ]] ; then
      return 0
    fi

    case "\${prev}" in
      ${cases.join(`\n${" ".repeat(6)}`)}
    esac
  }
${subCommands.join("\n")}
`.trimEnd();
}
