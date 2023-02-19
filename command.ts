// deno-lint-ignore-file no-explicit-any ban-types no-explicit-any no-explicit-any
import { Args as ArgsTuple, inferArgs, isArgs, walkArgs } from "./args.ts";
import {
  Flag,
  Flags,
  flags as opts_,
  getDefault,
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
    | ArgsTuple
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
>(
  name: string,
  {
    args,
    commands,
    flags,
    use,
    short,
    long,
    aliases = [],
    hidden = false,
  }: CommandConfig<Context, Args, Opts> = { flags: opts_({}) as any },
): Command<Context, Args, Opts> {
  let action: Action<Context, Args, Opts> | undefined;
  let preAction: Action<Context, Args, Opts> | undefined;
  let postAction: Action<Context, Args, Opts> | undefined;
  const hasArgs = isArgs(args);
  const hasCmds = !!commands?.length;

  function* help(path: string[] = []): Iterable<string> {
    const displayName = path.join(" ") || name;

    if (long || short) {
      const desc = typeof long === "function"
        ? long()
        : long
        ? long
        : typeof short === "function"
        ? short()
        : short + "";

      for (const line of dedent(desc)) {
        yield line;
      }

      yield "";
    }

    yield colors.bold("Usage");

    const hasAvailableCmds = hasCmds && commands.some((cmd) => !cmd.hidden);

    if (hasAvailableCmds && !use) {
      yield `  ${displayName} [command]`;
    }

    if (use) {
      yield typeof use === "function" ? `  ${use()}` : `  ${use}`;
    } else if (args) {
      let argsUsage = `  ${displayName}`;

      if (typeof args === "object" && "usage" in args && args.usage) {
        argsUsage += ` ${args.usage}`;
      } else {
        const hasOptionalArgs = args instanceof z.ZodDefault ||
          args instanceof z.ZodOptional ||
          (args instanceof z.ZodArray && !args._def.minLength?.value);

        walkArgs(args, (arg, { variadic }) => {
          if (variadic) {
            argsUsage += ` [arguments...]`;
          } else {
            argsUsage += hasOptionalArgs ||
                arg instanceof z.ZodOptional ||
                arg instanceof z.ZodDefault
              ? ` [arguments]`
              : ` <arguments>`;
          }
        });
      }

      yield argsUsage + ` [flags]`;
    } else {
      yield `  ${displayName} [flags]`;
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
          rows[i] = [cmd.name, cmd.shortDescription ?? ""];
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
    const docFlags: { path: string; flag: Flag }[] = [];

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
        opt.aliases.filter((a) => a.length === 1).map((a) => `-${a},`)[0] ?? "",
        `--${path}`,
        type instanceof z.ZodBoolean
          ? ""
          : type instanceof z.ZodEnum
          ? typeof type._def.values[0]
          : typeAsString(opt),
        (opt.shortDescription ?? "") +
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
    get usage() {
      return typeof use === "function" ? use() : use;
    },

    get shortDescription() {
      return typeof short === "function" ? short() : short;
    },

    get longDescription() {
      return typeof long === "function" ? long() : long;
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
        const subCommand = commands.find(
          (c) => c.name === cmd || c.aliases.indexOf(cmd) !== -1,
        );

        if (subCommand) {
          return await subCommand.execute(rest, ctx);
        }
      }

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
        if (err instanceof EnvError) {
          await Deno.stderr.write(encoder.encode(err.message));
          Deno.exit(1);
        } else if (isHelp(err)) {
          await writeHelp(help((ctx as any).path ?? []));
        } else if (err instanceof z.ZodError) {
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
      let a: unknown[] = [];

      if (hasArgs) {
        try {
          const defaultArgs = _.length === 0 && args instanceof z.ZodOptional
            ? undefined
            : _.length === 0 && args instanceof z.ZodDefault
            ? args._def.defaultValue()
            : _;

          a = (await args.parseAsync(defaultArgs)) ?? a;
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
      }

      const actionArgs = { args: a, flags: o, "--": doubleDash, ctx };

      // Run the action
      if (preAction) {
        await handleAction(preAction, actionArgs);
      }

      if (action) {
        await handleAction(action, actionArgs);
      }

      if (postAction) {
        await handleAction(postAction, actionArgs);
      }
    },
  };
}

async function handleAction<ActionFn extends Action<any, any, any, any>>(
  action: ActionFn,
  args: unknown,
) {
  if (isAsyncGenerator(action)) {
    const writes: Promise<number>[] = [];
    // @ts-expect-error: it's fine
    for await (const output of action(args)) {
      writes.push(Deno.stdout.write(encoder.encode((await output) + "\n")));
    }

    await Promise.all(writes);
  } else if (isGenerator(action)) {
    const writes: Promise<number>[] = [];
    // @ts-expect-error: it's fine
    for (const output of action(args)) {
      writes.push(Deno.stdout.write(encoder.encode(output + "\n")));
    }

    await Promise.all(writes);
  } else if ("then" in action && typeof action.then === "function") {
    // @ts-expect-error: it's fine
    await action(args);
  } else {
    // @ts-expect-error: it's fine
    action(args);
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
    | ArgsTuple
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
  GlobalOpts extends Flags | unknown = unknown,
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
   * The usage string for the command
   */
  usage?: string;
  /**
   * A short description of the command
   */
  shortDescription?: string;
  /**
   * A long description of the command
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
    | ArgsTuple
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
   * Aliases for the command
   */
  aliases?: string[];
  /**
   * Hide this command from the help text
   */
  hidden?: boolean;
  /**
   * Command usage
   */
  use?: string | (() => string);
  /**
   * A short description of the command
   */
  short?: string | (() => string);
  /**
   * A long description of the command
   */
  long?: string | (() => string);
};

export type Action<
  Context extends Record<string, unknown>,
  Args extends
    | ArgsTuple
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
  GlobalOpts extends Flags | unknown = unknown,
> = {
  /**
   * The action to run when the command is invoked
   * @param argopts The parsed arguments and options
   * @param ctx The context object
   */
  (
    opts: Prettify<
      {
        args: Args extends ArgsTuple ? inferArgs<Args> : unknown[];
        flags: Merge<
          (Opts extends {
            __flags: true;
            _output: any;
          } ? inferFlags<Opts>
            : {}),
          GlobalOpts extends Flags ? inferFlags<GlobalOpts> : {}
        >;
        "--": string[];
        ctx: Prettify<Context>;
      }
    >,
  ): Promise<void> | AsyncGenerator<string> | Generator<string> | void;
};

export type Execute<Context> = {
  (args?: string[], ctx?: Context): Promise<void>;
};
