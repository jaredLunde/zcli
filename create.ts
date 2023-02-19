// deno-lint-ignore-file no-explicit-any
import { Command, command, CommandConfig } from "./command.ts";
import { Args as ArgsTuple, args } from "./args.ts";
import { helpFlag, writeHelp } from "./help.ts";
import { flag, Flags, flags, walkFlags } from "./flags.ts";
import { z } from "./z.ts";
import { didYouMean } from "./lib/did-you-mean.ts";
import { colors } from "./fmt.ts";
import { table } from "./lib/simple-table.ts";
import * as intl from "./intl.ts";

export function create<
  Context extends Record<string, unknown>,
  GlobalOpts extends Flags,
>(
  config: CreateConfig<Context, GlobalOpts>,
): CommandFactory<Context, GlobalOpts> {
  const gOpts = config.globalFlags
    ? config.globalFlags.merge(helpOpts)
    : helpOpts;
  let bin: Command<Context, any, any, GlobalOpts>;

  walkFlags(gOpts, (flag) => {
    flag.__global = true;
  });

  return {
    ctx: config.ctx,
    get bin() {
      return bin;
    },
    globalFlags: config.globalFlags,
    command<
      Args extends
        | ArgsTuple
        | unknown = unknown,
      Opts extends Flags | unknown = unknown,
    >(
      name: string,
      options: CommandConfig<
        Context & BaseContext,
        Args,
        Opts
      > = {},
    ): Command<
      Context & BaseContext,
      Args,
      Opts,
      GlobalOpts
    > {
      // @ts-expect-error: blah blah
      options.flags = options.flags ? options.flags.merge(gOpts) : gOpts;

      if (options.commands?.length) {
        const helpCmd = command("help", {
          short: `Show help for a ${name} command`,
          flags: gOpts,
          commands: [
            command("commands", {
              short: `List ${name} commands`,

              flags: gOpts.merge(
                flags({
                  all: flag({
                    aliases: ["a"],
                    short: "Show all commands, including hidden ones",
                  }).boolean().default(false),
                }),
              ),
            })
              .run(async ({ flags }) => {
                await writeHelp(
                  (function* listCommands() {
                    yield colors.bold(`${name} commands`);
                    const sortedCmds = intl.collate(
                      options.commands!.filter(
                        (cmd) => flags.all || !cmd.hidden,
                      ),
                      {
                        get(item) {
                          return item.name;
                        },
                      },
                    );

                    const rows: string[][] = new Array(sortedCmds.length);

                    for (let i = 0; i < sortedCmds!.length; i++) {
                      const cmd = sortedCmds![i];
                      rows[i] = [cmd.name, cmd.shortDescription ?? ""];
                    }

                    for (
                      const line of table(rows, {
                        indent: 2,
                        cellPadding: 2,
                      })
                    ) {
                      yield line;
                    }

                    yield `\nUse "${name} help [command]" for more information about a command.`;
                  })(),
                );
              }),
          ],

          args: args().tuple([
            z.enum(
              options.commands.flatMap((c) => [c.name, ...c.aliases]).concat(
                "help",
              ) as [
                string,
                ...string[],
              ],
            ),
          ]).optional(),
        })
          .run(async ({ args, ctx }) => {
            if (!args[0]) {
              // @ts-expect-error: it's fine ffs
              await writeHelp(command_.help(ctx.path));
            }

            const cmd = options.commands!.find(
              (cmd) =>
                cmd.name === args[0] ||
                cmd.aliases.includes(args[0]!),
            );

            if (!cmd) {
              await Promise.all([
                Deno.stderr.write(
                  new TextEncoder().encode(
                    `Unknown help topic: "${args[0]}"\n`,
                  ),
                ),
                Deno.stderr.write(
                  new TextEncoder().encode(
                    didYouMean(
                      args[0] + "",
                      options
                        .commands!.flatMap((cmd) => [cmd.name, ...cmd.aliases])
                        .concat("commands"),
                    ) + "\n",
                  ),
                ),
              ]);

              Deno.exit(1);
            }

            await writeHelp(
              cmd.help(((ctx.path as any) ?? []).concat(cmd.name)),
            );
          });

        const execute = helpCmd.execute;
        // @ts-expect-error: ugh
        helpCmd.execute = (
          args: string[],
          ctx?: Context & BaseContext,
        ) => {
          bin = bin ?? ctx?.bin ?? command_;

          return execute(args, {
            ...(ctx ?? config.ctx),
            bin,
            path: args.includes("--help") || args.includes("-h")
              ? [...(ctx?.path ?? []), "help"]
              : ctx?.path,
          });
        };
        // @ts-expect-error: it's fine ffs
        options.commands = [...options.commands, helpCmd];
      }

      const command_ = command<
        Context & BaseContext,
        Args,
        Opts
      >(
        name,
        options,
      );
      const execute = command_.execute;
      const execOverride = {
        execute: (
          args: string[],
          ctx?: Context & BaseContext,
        ) => {
          bin = bin ?? ctx?.bin ?? command_;

          return execute(
            args,
            // @ts-expect-error: it's cool
            {
              ...(ctx ?? config.ctx),
              bin,
              path: [...(ctx?.path ?? []), name],
            },
          );
        },
      };
      // @ts-expect-error: it's fine ffs
      return Object.assign(command_, execOverride);
    },
  };
}

const helpOpts = flags({
  help: helpFlag({ short: "Show help for a command" }),
});

export type CreateConfig<
  Context extends Record<string, unknown>,
  GlobalOpts extends Flags,
> = {
  /**
   * The context that will be passed to each command.
   */
  ctx?: Context;
  /**
   * The global options that will be passed to each command.
   */
  globalFlags?: GlobalOpts;
};

export type BaseContext = {
  /**
   * The path of the command that is currently being parsed.
   */
  path: string[];
  /**
   * The root command that is being executed.
   */
  bin: Command<any, any, any, any>;
};

export type CommandFactory<
  Context extends Record<string, unknown>,
  GlobalOpts extends Flags,
> = {
  /**
   * Meta information about the CLI.
   */
  ctx?: Context;
  /**
   * The main/root command that is being executed. This will
   * be `undefined` if accessed outside of an execution environment.
   */
  bin?: Command<Context, any, any, GlobalOpts>;
  /**
   * Create a CLI command. Commands can be nested to create a tree
   * of commands. Each command can have its own set of flags and
   * arguments.
   *
   * @param name - The name of the command
   * @param param1 - The command configuration
   */
  command<
    Args extends
      | ArgsTuple
      | unknown = unknown,
    Opts extends Flags | unknown = unknown,
  >(
    name: string,
    config?: CommandConfig<
      Context & BaseContext,
      Args,
      Opts
    >,
  ): Command<
    Context & BaseContext,
    Args,
    Opts,
    GlobalOpts
  >;
  /**
   * Global flags that are passed to each command.
   */
  globalFlags?: GlobalOpts;
};

export type Meta = {
  /**
   * The version of the CLI.
   * @default "0.0.0"
   */
  version?: string;
} & Record<string, unknown>;

export type DefaultContext = BaseContext & Record<string, unknown>;

export type inferContext<Cmd extends CommandFactory<any, any>> = Cmd extends
  CommandFactory<
    infer Context,
    any
  > ? Context & BaseContext
  : BaseContext;
