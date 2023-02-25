// deno-lint-ignore-file no-explicit-any ban-types no-explicit-any no-explicit-any
import {
  Args as ArgsTuple,
  ArgsZodTypes,
  inferArgs,
  isArgs,
  walkArgs,
} from "./args.ts";
import {
  Flag,
  Flags,
  flags as flags_,
  getDefault,
  inferFlags,
  innerType,
  isFlags,
  typeAsString,
  walkFlags,
} from "./flags.ts";
import { Merge, Prettify } from "./lib/types.ts";
import { z } from "./z.ts";
import { EnvError } from "./env.ts";
import { isHelp } from "./help.ts";
import { dedent } from "./lib/dedent.ts";
import { table } from "./lib/simple-table.ts";
import { colors } from "./fmt.ts";
import * as intl from "./intl.ts";
import { didYouMean } from "./lib/did-you-mean.ts";
import * as flagsParser from "./flags-parser.ts";
import { textEncoder } from "./lib/text-encoder.ts";
import { shorten } from "./lib/shorten.ts";
import { writeIterable } from "./lib/write-iterable.ts";

/**
 * Create a CLI command. Commands can be nested to create a tree
 * of commands. Each command can have its own set of flags and
 * arguments.
 *
 * @param name - The name of the command
 * @param param1 - The command configuration
 */
export function command<
  Context extends DefaultContext,
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
    deprecated,
    hidden = false,
    meta = {},
  }: CommandConfig<Context, Args, Opts> = { flags: flags_({}) as any },
): Command<Context, Args, Opts> {
  let action: Action<Context, Args, Opts> | undefined;
  let persistentPreAction:
    | PersistentAction<Context, any>
    | undefined;
  let preAction: Action<Context, Args, Opts> | undefined;
  let postAction: Action<Context, Args, Opts> | undefined;
  let persistentPostAction:
    | PersistentAction<Context, any>
    | undefined;
  const hasCmds = !!commands?.length;

  function* help(context: Context): Iterable<string> {
    const displayName = context.path.join(" ") || name;

    if (long || short) {
      const desc = typeof long === "function"
        ? long(context)
        : long
        ? long
        : typeof short === "function"
        ? short(context)
        : short + "";

      for (const line of dedent(desc)) {
        yield line;
      }

      yield "";
    }

    if (deprecated) {
      yield colors.bold(colors.red("Deprecated"));

      for (const line of dedent(deprecated)) {
        yield `  ${line}`;
      }

      yield "";
    }

    yield colors.bold("Usage");

    const hasAvailableCmds = hasCmds && commands.some((cmd) => !cmd.hidden);

    if (use) {
      yield `  ${use}`;
    } else {
      if (hasAvailableCmds) {
        yield `  ${displayName} [command]`;
      }

      if (args) {
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
    }

    if (aliases.length) {
      yield colors.bold("\nAliases");
      yield `  ${name}, ${aliases.join(", ")}`;
    }

    if (hasAvailableCmds) {
      yield colors.bold("\nAvailable Commands");

      const sortedCmds = intl.collate(
        commands.filter((cmd) => !cmd.hidden),
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
          rows[i] = [cmd.name, cmd.short(context) ?? ""];
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
        (opt.short(context) || shorten(opt.long(context) ?? "")) +
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
          cellPadding: [1, 1, 2],
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
    hidden: hidden || typeof deprecated === "string",
    deprecated,
    help,
    usage: use,
    meta,

    short(context) {
      let description: string | undefined;

      if (typeof short === "function") {
        description = short(context);
      } else {
        description = short;
      }

      return description && [...dedent(description)].join(" ");
    },

    long(context) {
      let description: string | undefined;

      if (typeof long === "function") {
        description = long(context);
      } else {
        description = long;
      }

      return description && [...dedent(description)].join("\n");
    },

    persistentPreRun(action_) {
      persistentPreAction = action_;
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

    persistentPostRun(action_) {
      persistentPostAction = action_;
      return this;
    },

    postRun(action_) {
      postAction = action_;
      return this;
    },

    async execute(argv = Deno.args, ctx) {
      if (hasCmds && argv[0] !== undefined && argv[0][0] !== "-") {
        const [cmd, ...rest] = argv;
        const subCommand = commands.find(
          (c) => c.name === cmd || c.aliases.indexOf(cmd) !== -1,
        );

        if (subCommand) {
          // Attach persistent pre/post run hooks to the subcommand.
          if (persistentPreAction) {
            subCommand.persistentPreRun(persistentPreAction);
          }

          if (persistentPostAction) {
            subCommand.persistentPostRun(persistentPostAction);
          }

          return subCommand.execute(rest, ctx);
        }

        // If the command is not found, we check if the command also receives
        // arguments. If it does, we assume that the user is trying to run a
        // command with arguments. Otherwise, we show a helpful error message.
        if (!args) {
          const message = `Unknown command "${cmd}" for "${
            ctx!.path.join(" ")
          }"\n${
            didYouMean(cmd, commands.flatMap((c) => [c.name, ...c.aliases]))
          }\n`;
          await Deno.stderr.write(textEncoder.encode(message));
          Deno.exit(1);
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

      if (isFlags(flags)) {
        try {
          o = await flags.parseAsync(parsed);
        } catch (err) {
          if (err instanceof EnvError) {
            await Deno.stderr.write(textEncoder.encode(err.message));
            Deno.exit(1);
          } else if (isHelp(err)) {
            await writeIterable(help(ctx as any));
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
              textEncoder.encode(
                errors[0] + `\n⚘ See --help for more information.\n`,
              ),
            );

            Deno.exit(1);
          }

          throw err;
        }
      }

      // Parse the arguments
      let a: unknown[] = [];

      if (isArgs(args)) {
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
              textEncoder.encode(
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

      if (deprecated) {
        const writes: Promise<number>[] = [];

        writes.push(Deno.stderr.write(
          textEncoder.encode(`${colors.yellow("Deprecation Warning")}\n`),
        ));

        for (const line of dedent(deprecated)) {
          writes.push(Deno.stderr.write(textEncoder.encode(line + "\n")));
        }

        await Promise.all(writes);
      }

      const actionArgs = { args: a, flags: o, "--": doubleDash, ctx };
      const persistentActionArgs = {
        args: a,
        flags: o,
        "--": doubleDash,
        ctx: {
          ...ctx,
          cmd: this,
        },
      };
      // Run the action
      await handleAction(persistentPreAction, persistentActionArgs);
      await handleAction(preAction, actionArgs);
      await handleAction(action, actionArgs);
      await handleAction(postAction, actionArgs);
      await handleAction(persistentPostAction, persistentActionArgs);
    },
  };
}

async function handleAction<
  ActionFn extends
    | Action<any, any, any, any>
    | PersistentAction<any, any>,
>(
  action: ActionFn | undefined,
  args: unknown,
) {
  if (!action) {
    return;
  }

  if (isAsyncGenerator(action)) {
    const writes: Promise<number>[] = [];
    // @ts-expect-error: it's fine
    for await (const output of action(args)) {
      writes.push(Deno.stdout.write(textEncoder.encode((await output) + "\n")));
    }

    await Promise.all(writes);
  } else if (isGenerator(action)) {
    const writes: Promise<number>[] = [];
    // @ts-expect-error: it's fine
    for (const output of action(args)) {
      writes.push(Deno.stdout.write(textEncoder.encode(output + "\n")));
    }

    await Promise.all(writes);
  } else {
    // @ts-expect-error: it's fine
    await action(args);
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

export type Command<
  Context extends DefaultContext,
  Args extends
    | ArgsTuple
    | unknown = unknown,
  Opts extends Flags | unknown = unknown,
  GlobalOpts extends Flags | unknown = unknown,
> = {
  /**
   * The name of the command
   */
  name: Readonly<string>;
  /**
   * The aliases of the command
   */
  aliases: ReadonlyArray<string>;
  /**
   * Subcommands for this command
   */
  commands: ReadonlyArray<Command<Context, any, any, GlobalOpts>>;
  /**
   * Command arguments
   */
  args: Readonly<Args>;
  /**
   * Command flags
   */
  flags: Readonly<Opts>;
  /**
   * Whether or not the command is hidden
   */
  hidden: Readonly<boolean>;
  /**
   * Whether or not the command is deprecated
   */
  deprecated: Readonly<string | undefined>;
  /**
   * Returns the help text for the command
   */
  help(context: Context): Iterable<string>;
  /**
   * The metadata for the command
   */
  meta: Readonly<Record<string, unknown>>;
  /**
   * The usage string for the command
   */
  usage?: Readonly<string>;
  /**
   * A short description of the command
   */
  short(context: Context): string | undefined;
  /**
   * A long description of the command
   */
  long(context: Context): string | undefined;
  /**
   * Run this action before the "run" command. This will also run before any
   * subcommands. It will override any defined `persistentPreRun` actions on
   * subcommands.
   *
   * @param action - The action to run before the "run" command
   */
  persistentPreRun(
    action: PersistentAction<
      Context,
      GlobalOpts
    >,
  ): Command<Context, Args, Opts, GlobalOpts>;
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
   * Run this action before the "run" command. This will also run before any
   * subcommands. It will override any defined `persistentPreRun` actions on
   * subcommands.
   *
   * @param action - The action to run before the "run" command
   */
  persistentPostRun(
    action: PersistentAction<
      Context,
      GlobalOpts
    >,
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
  Context extends BaseContext = DefaultContext,
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
   * Mark this command as deprecated. This will show a warning when the command
   * is used. It will also hide the command from the help text.
   */
  deprecated?: string;
  /**
   * Command usage
   */
  use?: string;
  /**
   * A short description of the command
   */
  short?: string | ((context: Context) => string);
  /**
   * A long description of the command
   */
  long?: string | ((context: Context) => string);
  /**
   * Add metadata to the command
   */
  meta?: Record<string, unknown>;
};

export type PersistentAction<
  Context extends DefaultContext,
  GlobalOpts extends Flags | unknown = unknown,
> = {
  /**
   * The action to run when the command is invoked
   * @param argopts The parsed arguments and options
   * @param ctx The context object
   */
  (
    opts: {
      /**
       * A parsed arguments array or tuple
       */
      args: unknown[];
      /**
       * A parsed flags object
       */
      flags: GlobalOpts extends Flags ? inferFlags<GlobalOpts>
        : Record<string, unknown>;
      /**
       * Unparsed arguments that were passed to this command after
       * the `--` separator.
       */
      "--": string[];
      /**
       * The context object
       */
      ctx: Prettify<
        Context & {
          /**
           * The command that was invoked
           */
          cmd: Command<any, any, any, GlobalOpts>;
        }
      >;
    },
  ): Promise<void> | AsyncGenerator<string> | Generator<string> | void;
};

export type Action<
  Context extends DefaultContext,
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
    opts: {
      /**
       * A parsed arguments array or tuple
       */
      args: Args extends ArgsTuple | ArgsZodTypes ? inferArgs<Args>
        : unknown[];
      /**
       * A parsed flags object
       */
      flags: Merge<
        (Opts extends {
          __flags: true;
          _output: any;
        } ? inferFlags<Opts>
          : {}),
        GlobalOpts extends Flags ? inferFlags<GlobalOpts> : {}
      >;
      /**
       * Unparsed arguments that were passed to this command after
       * the `--` separator.
       */
      "--": string[];
      /**
       * The context object
       */
      ctx: Prettify<Context>;
    },
  ): Promise<void> | AsyncGenerator<string> | Generator<string> | void;
};

export type Execute<Context> = {
  (args?: string[], ctx?: Context): Promise<void>;
};

export type BaseContext = {
  /**
   * The path of the command that is currently being parsed.
   */
  path: string[];
  /**
   * The root command that is being executed.
   */
  root: Command<any, any, any, any>;
};

export type DefaultContext = BaseContext & Record<string, unknown>;
