// deno-lint-ignore-file no-explicit-any
import { BaseContext, Command, command, CommandConfig } from "./command.ts";
import { Args as ArgsTuple, args } from "./args.ts";
import { helpFlag } from "./help.ts";
import { flag, Flags, flags, isFlags, walkFlags } from "./flags.ts";
import { z } from "./z.ts";
import { colors } from "./fmt.ts";
import { table } from "./lib/simple-table.ts";
import * as intl from "./intl.ts";
import { writeIterable } from "./lib/write-iterable.ts";

export function init<
  Context extends Record<string, unknown>,
  GlobalOpts extends Flags | unknown = unknown,
>(
  config: InitConfig<Context, GlobalOpts> = {},
): CommandFactory<Context, GlobalOpts> {
  const gOpts = isFlags(config.globalFlags)
    ? config.globalFlags.merge(helpOpts)
    : helpOpts;

  walkFlags(gOpts, (flag) => {
    flag.__global = true;
  });

  return {
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
      options = { ...options };
      const subCommands = options.commands ? [...options.commands] : undefined;

      if (subCommands?.length) {
        const helpCommand = command("help", {
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
              .run(async ({ flags, ctx }) => {
                await writeIterable(
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
                      rows[i] = [cmd.name, cmd.short(ctx as any) ?? ""];
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
              subCommands.flatMap((c) => [c.name, ...c.aliases]).concat(
                "help",
              ) as [
                string,
                ...string[],
              ],
            ).describe("The command to show help for."),
          ]).optional(),
        })
          .run(async ({ args, ctx }) => {
            if (!args[0]) {
              return await writeIterable(command_.help(ctx));
            }

            const cmd = subCommands.find(
              (cmd) =>
                cmd.name === args[0] ||
                cmd.aliases.includes(args[0] as any),
            )!;

            await writeIterable(
              cmd.help(
                { ...ctx, path: ctx.path.slice(0, -1).concat(cmd.name) } as any,
              ),
            );
          });
        // @ts-expect-error: all good
        subCommands.push(executeWithContext(helpCommand, config));
      }

      // @ts-expect-error: blah blah
      options.flags = options.flags ? options.flags.merge(gOpts) : gOpts;
      options.commands = subCommands;
      const command_ = executeWithContext(
        command(name, options),
        config,
      );

      // @ts-expect-error: all good
      return command_;
    },
  };
}

function executeWithContext(
  command: Command<any, any, any>,
  config: InitConfig<any, any>,
) {
  return {
    ...command,
    execute(
      args: string[],
      ctx?: any,
    ) {
      const execute = command.execute.bind(this);
      const path = ctx?.path ?? emptyArray;
      const root = ctx?.root ?? this;

      return execute(
        args,
        {
          ...(ctx ?? config.ctx),
          root,
          path: [...path, command.name],
        },
      );
    },
  };
}

const emptyArray: string[] = [];

const helpOpts = flags({
  help: helpFlag({ short: "Show help for a command" }),
});

export type InitConfig<
  Context extends Record<string, unknown>,
  GlobalOpts extends Flags | unknown = unknown,
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

export type CommandFactory<
  Context extends Record<string, unknown>,
  GlobalOpts extends Flags | unknown = unknown,
> = {
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
};

export type inferContext<Cmd extends CommandFactory<any, any>> = Cmd extends
  CommandFactory<
    infer Context,
    any
  > ? Context & BaseContext
  : BaseContext;
