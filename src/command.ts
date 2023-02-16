// deno-lint-ignore-file no-explicit-any ban-types no-explicit-any no-explicit-any
import {
  Arg,
  Args as ArgsTuple,
  OptionalArgsWithoutVariadic,
  OptionalArgsWithVariadic,
  walkArgs,
} from "./args.ts";
import {
  Flag,
  Flags,
  flags as opts_,
  getDefault,
  GlobalFlags,
  inferFlags,
  innerType,
  typeAsString,
  walkFlags,
} from "./flags.ts";
import { Merge, Prettify } from "./lib/types.ts";
import { z } from "./z.ts";
import { EnvError } from "./env.ts";
import { isHelp, writeHelp } from "./help.ts";
import { dedent } from "./lib/dedent.ts";
import { table } from "./lib/simple-table.ts";
import { colors } from "./fmt.ts";
import * as intl from "./intl.ts";
import { didYouMean } from "./lib/did-you-mean.ts";
import * as flagsParser from "./flags-parser.ts";

/**
 * Create a CLI command. Commands can be nested to create a tree
 * of commands. Each command can have its own set of flags and
 * arguments.
 *
 * @param name - The name of the command
 * @param param1 - The command configuration
 */
export function command<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
      Arg<string, z.ZodTypeAny>,
      Arg<string, z.ZodTypeAny>[],
      Arg<string, z.ZodTypeAny> | null
    >
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
>(
  name: string,
  {
    args,
    commands,
    flags,
    meta,
    aliases = [],
    hidden = false,
  }: CommandConfig<Context, Args, Opts> = { flags: opts_({}) as any },
): Command<Context, Args, Opts> {
  let action: Action<Context, Args, Opts> | undefined;
  let preAction: Action<Context, Args, Opts> | undefined;
  let postAction: Action<Context, Args, Opts> | undefined;
  let description = "";
  let longDescription = "";
  const hasOptionalArgs = args instanceof z.ZodOptional ||
    args instanceof z.ZodDefault;
  const hasArgs = args instanceof z.ZodTuple || hasOptionalArgs;
  const variadicArg = !hasArgs
    ? null
    : hasOptionalArgs
    ? args._def.innerType._def.rest
    : args._def.rest;
  const hasCmds = !!commands?.length;

  function* help(path: string[] = []): Iterable<string> {
    const displayName = path.join(" ") || name;

    if (longDescription || description) {
      for (const line of dedent(longDescription || description)) {
        yield line;
      }

      yield "";
    }

    yield colors.bold("Usage");

    const hasAvailableCmds = hasCmds && !commands.every((cmd) => cmd.hidden);

    if (hasAvailableCmds && !meta?.usage) {
      yield `  ${displayName} [command]`;
    }

    if (meta?.usage) {
      yield meta.usage.join("\n  ");
    } else if (args) {
      let argsUsage = `  ${displayName}`;

      const hasOptionalArgs = args instanceof z.ZodOptional ||
        args instanceof z.ZodDefault;

      walkArgs(args, (arg, { variadic }) => {
        if (variadic) {
          argsUsage += ` [${arg.name}...]`;
        } else {
          argsUsage += hasOptionalArgs ||
              arg instanceof z.ZodOptional ||
              arg instanceof z.ZodDefault
            ? ` [${arg.name}]`
            : ` <${arg.name}>`;
        }
      });

      yield argsUsage + ` [flags]`;
    }

    if (hasAvailableCmds) {
      yield colors.bold("\nAvailable commands");

      const sortedCmds = intl.collate(
        commands!.filter((cmd) => !cmd.hidden),
        {
          get(item) {
            return item.name;
          },
        },
      );

      const rows: string[][] = new Array(sortedCmds.length);

      for (let i = 0; i < sortedCmds.length; i++) {
        const cmd = sortedCmds[i];

        if (!cmd.hidden) {
          rows[i] = [cmd.name, cmd.description ?? ""];
        }
      }

      for (
        const line of table(rows, {
          indent: 2,
          cellPadding: 2,
        })
      ) {
        yield line;
      }
    }

    if (aliases.length) {
      yield colors.bold("\nAliases");
      yield `  ${name}, ${aliases.join(", ")}`;
    }

    const rows: string[][] = [];
    const globalRows: string[][] = [];
    const docFlags: { path: string; flag: Flag<any, any> }[] = [];

    walkFlags(flags, (opt, path) => {
      docFlags.push({ path, flag: opt });
    });

    for (
      const { path, flag: opt } of intl.collate(docFlags, {
        get(item) {
          return item.path;
        },
      })
    ) {
      const type = innerType(opt);
      const rows_ = opt.__global ? globalRows : rows;
      const defaultValue = getDefault(opt);

      rows_.push([
        opt.aliases.map((a) => `-${a},`).join(" "),
        `--${path}`,
        type instanceof z.ZodBoolean
          ? ""
          : type instanceof z.ZodEnum
          ? typeof type._def.values[0]
          : typeAsString(opt),
        (opt.description ?? "") +
        (!(type instanceof z.ZodBoolean) && defaultValue
          ? ` (default: ${defaultValue})`
          : ""),
      ]);
    }

    if (rows.length) {
      yield colors.bold("\nFlags");

      for (
        const line of table(rows, {
          indent: 2,
          cellPadding: [1, 1, 2],
        })
      ) {
        yield line;
      }
    }

    if (globalRows.length) {
      yield colors.bold("\nGlobal Flags");

      for (
        const line of table(globalRows, {
          indent: 2,
          cellPadding: [1, 2],
        })
      ) {
        yield line;
      }
    }

    if (hasCmds) {
      yield `\nUse "${displayName} [command] --help" for more information about a command.`;
    }
  }

  return {
    name,
    aliases,
    commands: commands ?? [],
    // @ts-expect-error: so dumb
    args: args,
    // @ts-expect-error: so dumb
    flags: flags ?? {},
    hidden,
    help,

    get description() {
      return description;
    },

    describe(str: string) {
      description = str;
      return this;
    },

    get longDescription() {
      return longDescription;
    },

    long(description: string) {
      longDescription = description;
      return this;
    },

    preRun(action_) {
      preAction = action_;
      return this;
    },

    run(action_) {
      action = action_;
      return this;
    },

    postRun(action_) {
      postAction = action_;
      return this;
    },

    async execute(argv = Deno.args, ctx) {
      if (hasCmds) {
        const [cmd, ...rest] = argv;
        const match = commands.find(
          (c) => c.name === cmd || c.aliases.includes(cmd),
        );

        if (match) {
          return await match.execute(rest, ctx);
        }
      }

      try {
        const bools: Record<string, boolean> = {};
        const numbers: Record<string, boolean> = {};
        const collect: Record<string, boolean> = {};
        const negatable: Record<string, boolean> = {};
        const aliases: Record<string, string> = {};
        const optionNames: string[] = [];

        walkFlags(flags, (schema, name) => {
          optionNames.push(name, ...schema.aliases);

          if (
            schema instanceof z.ZodArray ||
            schema._def.innerType instanceof z.ZodArray
          ) {
            collect[name] = true;
          }

          if (innerType(schema) instanceof z.ZodBoolean) {
            bools[name] = true;
          }

          if (innerType(schema) instanceof z.ZodNumber) {
            numbers[name] = true;
          }

          if (schema.negatable) {
            negatable[name] = true;
          }

          if (schema.aliases.length > 0) {
            for (const alias of schema.aliases) {
              aliases[alias] = name;
            }
          }
        });

        const {
          _,
          _doubleDash: doubleDash,
          ...parsed
        } = flagsParser.parse(argv, {
          bools,
          numbers,
          collect,
          negatable,
          aliases,
        });

        // Parse the options
        let o: Record<string, unknown> = {};

        try {
          // @ts-expect-error: balh blah
          o = await flags!.parseAsync(parsed);
        } catch (err) {
          if (!isHelp(err) && err instanceof z.ZodError) {
            const formErrors = err.formErrors;
            const errors = err.errors.map((e) => {
              if (e.code === z.ZodIssueCode.unrecognized_keys) {
                return (
                  `${
                    intl.plural(e.keys.length, "Unknown flag", {
                      hideCount: true,
                    })
                  }: ${e.keys.join(", ")}\n` +
                  didYouMean(e.keys[0], optionNames)
                );
              } else if (e.code === z.ZodIssueCode.invalid_type) {
                return `Invalid type for flag "${
                  e.path.join(".")
                }". Expected ${e.expected}, but received ${e.received}.`;
              } else if (e.code === z.ZodIssueCode.invalid_enum_value) {
                return `Invalid value for flag "${
                  e.path.join(
                    ".",
                  )
                }". Expected ${
                  intl.list(
                    e.options.map((o) => "" + o),
                    {
                      type: "disjunction",
                    },
                  )
                }. Received ${e.received}.`;
              }

              return `Invalid value for flag "${e.path.join(".")}". ${
                formErrors.fieldErrors[e.path[0]]
              }`;
            });

            await Deno.stderr.write(
              encoder.encode(
                errors[0] + `\n⚘ See --help for more information.\n`,
              ),
            );

            Deno.exit(1);
          }

          throw err;
        }

        // Parse the arguments
        const a: Record<string, unknown> = variadicArg
          ? { [variadicArg.name]: [] }
          : {};

        if (hasArgs) {
          const defaultArgs = _.length === 0 && args instanceof z.ZodOptional
            ? undefined
            : _.length === 0 && args instanceof z.ZodDefault
            ? args._def.defaultValue()
            : _;
          let parsedArgs: unknown[] = [];

          try {
            parsedArgs = (await args.parseAsync(defaultArgs)) ?? parsedArgs;
          } catch (err) {
            if (err instanceof z.ZodError) {
              const errors = err.errors.map((e) => {
                if (e.code === z.ZodIssueCode.too_small) {
                  return `expected at least ${
                    intl.plural(
                      e.minimum,
                      "argument",
                    )
                  } arguments`;
                } else if (e.code === z.ZodIssueCode.too_big) {
                  return `expected at most ${
                    intl.plural(
                      e.maximum,
                      "argument",
                    )
                  }`;
                } else if (e.code === z.ZodIssueCode.invalid_type) {
                  return `expected ${e.expected}, but received ${e.received}`;
                } else if (e.code === z.ZodIssueCode.invalid_enum_value) {
                  return `expected ${
                    intl.list(
                      e.options.map((o) => "" + o),
                      {
                        type: "disjunction",
                      },
                    )
                  }. Received ${e.received}.`;
                }

                return e.message;
              });

              await Deno.stderr.write(
                encoder.encode(
                  `Invalid arguments: ${
                    errors[0]
                  }.\n⚘ See --help for more information.\n`,
                ),
              );

              Deno.exit(1);
            }

            throw err;
          }

          walkArgs(args, (item, { position, variadic }) => {
            const arg = parsedArgs[position];

            if (!arg) {
              return;
            }

            if (item && item.name === variadicArg?.name && !variadic) {
              const collect = a[item.name];

              if (!collect) {
                a[item.name] = [arg];
              } else if (Array.isArray(collect)) {
                collect.push(arg);
              }
            } else if (!variadic) {
              a[item.name] = arg;
            } else {
              let collect = a[variadicArg.name] as any[];

              if (!collect) {
                collect = a[variadicArg.name] = [arg];
              } else if (Array.isArray(collect)) {
                collect.push(arg);
              }

              for (const a of parsedArgs.slice(position + 1)) {
                collect.push(a);
              }
            }
          });
        }

        const actionArgs = { ...a, ...o, "--": doubleDash };

        // Run the action
        if (preAction) {
          await handleAction(preAction, actionArgs, ctx!);
        }

        if (action) {
          await handleAction(action, actionArgs, ctx!);
        }

        if (postAction) {
          await handleAction(postAction, actionArgs, ctx!);
        }
      } catch (err) {
        if (err instanceof EnvError) {
          await Deno.stderr.write(encoder.encode(err.message));
          Deno.exit(1);
        }

        if (isHelp(err)) {
          await writeHelp(help((ctx as any).path ?? []));
        }

        throw err;
      }
    },
  };
}

async function handleAction<ActionFn extends Action<any, any, any, any>>(
  action: ActionFn,
  args: unknown,
  ctx: unknown,
) {
  if (isAsyncGenerator(action)) {
    const writes: Promise<number>[] = [];
    // @ts-expect-error: it's fine
    for await (const output of action(args, ctx)) {
      writes.push(Deno.stdout.write(encoder.encode((await output) + "\n")));
    }

    await Promise.all(writes);
  } else if (isGenerator(action)) {
    const writes: Promise<number>[] = [];
    // @ts-expect-error: it's fine
    for (const output of action(args, ctx)) {
      writes.push(Deno.stdout.write(encoder.encode(output + "\n")));
    }

    await Promise.all(writes);
  } else if ("then" in action && typeof action.then === "function") {
    // @ts-expect-error: it's fine
    await action(Args, ctx);
  } else {
    // @ts-expect-error: it's fine
    action(args, ctx);
  }
}

function isAsyncGenerator<Fn extends (...args: any[]) => any>(
  fn: Fn,
  // @ts-expect-error: it's fine
): fn is (...args: Parameters<Fn>) => AsyncGenerator<any, any, any> {
  return fn.constructor === _asyncGenerator.constructor;
}

function isGenerator<Fn extends (...args: any[]) => any>(
  fn: Fn,
  // @ts-expect-error: it's fine
): fn is (...args: Parameters<Fn>) => Generator<any, any, any> {
  return fn.constructor === _generator.constructor;
}

async function* _asyncGenerator() {}
function* _generator() {}

const encoder = new TextEncoder();

export type Command<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
      Arg<string, z.ZodTypeAny>,
      Arg<string, z.ZodTypeAny>[],
      Arg<string, z.ZodTypeAny> | null
    >
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
  GlobalOpts extends GlobalFlags | unknown = unknown,
> = {
  /**
   * The name of the command
   */
  name: string;
  /**
   * The aliases of the command
   */
  aliases: string[];
  /**
   * Subcommands for this command
   */
  commands: Command<Context, any, any, GlobalOpts>[];
  /**
   * Command arguments
   */
  args: Args;
  /**
   * Command flags
   */
  flags: Opts;
  /**
   * Whether or not the command is hidden
   */
  hidden: boolean;
  /**
   * Returns the help text for the command
   */
  help(path?: string[]): Iterable<string>;
  /**
   * A short description of the command
   *
   * @param description The description of the command
   */
  describe(description: string): Command<Context, Args, Opts, GlobalOpts>;
  /**
   * A long description of the command
   *
   * @param description The description of the command
   */
  long(description: string): Command<Context, Args, Opts, GlobalOpts>;
  /**
   * The short description of the command
   */
  description?: string;
  /**
   * The long description of the command
   */
  longDescription?: string;
  /**
   * Run this action before the "run" command
   * @param action The action to run before the "run" command
   */
  preRun(
    action: Action<Context, Args, Opts, GlobalOpts>,
  ): Command<Context, Args, Opts, GlobalOpts>;
  /**
   * Run this action when the command is invoked
   * @param action The action to run when the command is invoked
   */
  run(
    action: Action<Context, Args, Opts, GlobalOpts>,
  ): Command<Context, Args, Opts, GlobalOpts>;
  /**
   * Run this action after the "run" command
   * @param action The action to run after the "run" command
   */
  postRun(
    action: Action<Context, Args, Opts, GlobalOpts>,
  ): Command<Context, Args, Opts, GlobalOpts>;
  /**
   * Parse `Deno.args` and run the command
   * @param argv The arguments to parse
   */
  execute: Execute<Context>;
};

export type CommandConfig<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
      Arg<string, z.ZodTypeAny>,
      Arg<string, z.ZodTypeAny>[],
      Arg<string, z.ZodTypeAny> | null
    >
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
> = {
  /**
   * Add arguments to the command
   */
  args?: Args;
  /**
   * Add options to the command
   */
  flags?: Opts;
  /**
   * Add subcommands to the command
   */
  commands?: Command<Context>[];
  /**
   * Command metadata
   */
  meta?: Meta;
  /**
   * Aliases for the command
   */
  aliases?: string[];
  /**
   * Hide this command from the help text
   */
  hidden?: boolean;
};

export type Action<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple<
      Arg<string, z.ZodTypeAny>,
      Arg<string, z.ZodTypeAny>[],
      Arg<string, z.ZodTypeAny> | null
    >
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
  GlobalOpts extends GlobalFlags | unknown = unknown,
> = {
  /**
   * The action to run when the command is invoked
   * @param argopts The parsed arguments and options
   * @param ctx The context object
   */
  (
    argopts: Prettify<
      Merge<
        ArgsMap<Args>,
        Merge<
          (Opts extends Flags ? inferFlags<Opts> : {}) & { "--": string[] },
          GlobalOpts extends GlobalFlags ? inferFlags<GlobalOpts> : {}
        >
      >
    >,
    ctx: Prettify<Context>,
  ): Promise<void> | AsyncGenerator<string> | Generator<string> | void;
};

export type Execute<Context> = {
  (args?: string[], ctx?: Context): Promise<void>;
};

export type ArgsMap<
  Args extends
    | ArgsTuple<
      Arg<string, z.ZodTypeAny>,
      Arg<string, z.ZodTypeAny>[],
      Arg<string, z.ZodTypeAny> | null
    >
    | unknown = unknown,
> = Args extends ArgsTuple<infer ZodType, infer ZodTypes, infer VariadicType>
  ? Merge<
    Args extends
      | OptionalArgsWithoutVariadic<any, any>
      | OptionalArgsWithVariadic<any, any, any>
      ? Partial<ArgsTupleMap<ZodType, ZodTypes>>
      : ArgsTupleMap<ZodType, ZodTypes>,
    VariadicType extends Arg<string, z.ZodTypeAny> ? {
        [k in VariadicType["name"]]: VariadicType["_output"][];
      }
      : {}
  >
  : {};

export type ArgsTupleMap<
  ZodType extends Arg<string, z.ZodTypeAny>,
  ZodTypes extends Arg<string, z.ZodTypeAny>[],
> =
  & {
    [k in ZodType["name"]]: ZodType["_output"];
  }
  & {
    [
      Index in Exclude<keyof ZodTypes, keyof any[]> as ZodTypes[Index] extends {
        name: string;
      } ? ZodTypes[Index]["name"]
        : never
    ]: ZodTypes[Index] extends Arg<string, z.ZodTypeAny>
      ? ZodTypes[Index]["_output"]
      : never;
  };

export type Meta = {
  usage?: string[];
};
