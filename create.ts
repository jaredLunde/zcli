// deno-lint-ignore-file no-explicit-any
import { Command, command, CommandConfig } from "./command.ts";
import { Arg, arg, Args as ArgsTuple, args } from "./args.ts";
import { helpFlag, writeHelp } from "./help.ts";
import { flag, Flags, flags, GlobalFlags } from "./flags.ts";
import { z } from "./z.ts";
import { didYouMean } from "./lib/did-you-mean.ts";
import { colors } from "./fmt.ts";
import { table } from "./lib/simple-table.ts";
import * as intl from "./intl.ts";

export function create<
  Context extends Record<string, unknown>,
  GlobalOpts extends GlobalFlags,
>(
  config: CreateConfig<Context, GlobalOpts>,
): CommandFactory<Context, GlobalOpts> {
  const gOpts = config.globalFlags
    ? config.globalFlags.merge(helpOpts)
    : helpOpts;
  let bin: Command<Context, any, any, GlobalOpts>;

  return {
    ctx: config.ctx,
    get bin() {
      return bin;
    },
    globalFlags: config.globalFlags,
    command<
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
          flags: gOpts,
          commands: [
            command("commands", {
              flags: gOpts.merge(
                flags({
                  all: flag(z.boolean().default(false), {
                    aliases: ["a"],
                  }).describe("Show all commands, including hidden ones"),
                }),
              ),
            })
              .run(async (args) => {
                await writeHelp(
                  (function* listCommands() {
                    yield colors.bold(`${name} commands`);
                    const sortedCmds = intl.collate(
                      options.commands!.filter(
                        (cmd) => args.all || !cmd.hidden,
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
                      rows[i] = [cmd.name, cmd.description ?? ""];
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
              })
              .describe(`List ${name} commands`),
          ],

          args: args([
            arg(
              "command",
              z.enum(
                options.commands.flatMap((c) => [c.name, ...c.aliases]).concat(
                  "help",
                ) as [
                  string,
                  ...string[],
                ],
              ),
            ).describe("The command to read help for"),
          ]).optional(),
        })
          .describe(`Show help for a ${name} command`)
          .run(async (args: any, ctx) => {
            if (!args.command) {
              // @ts-expect-error: it's fine ffs
              await writeHelp(command_.help(ctx.path));
            }

            const cmd = options.commands!.find(
              (cmd) =>
                cmd.name === args.command ||
                cmd.aliases.includes(args.command!),
            );

            if (!cmd) {
              await Promise.all([
                Deno.stderr.write(
                  new TextEncoder().encode(
                    `Unknown help topic: "${args.command}"\n`,
                  ),
                ),
                Deno.stderr.write(
                  new TextEncoder().encode(
                    didYouMean(
                      args.command + "",
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
      const execute = command_.execute.bind(command_);
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
  help: helpFlag().describe("Show help for this command"),
});

export type CreateConfig<
  Context extends Record<string, unknown>,
  GlobalOpts extends GlobalFlags,
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
   * The main command that is being executed.
   */
  bin: Command<any, any, any, any>;
};

export type CommandFactory<
  Context extends Record<string, unknown>,
  GlobalOpts extends GlobalFlags,
> = {
  /**
   * Meta information about the CLI.
   */
  ctx?: Context;
  /**
   * The main/root command that is being executed.
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
      | ArgsTuple<
        Arg<string, z.ZodTypeAny>,
        Arg<string, z.ZodTypeAny>[],
        Arg<string, z.ZodTypeAny> | null
      >
      | unknown = unknown,
    Opts extends Flags | unknown = unknown,
  >(
    name: string,
    options?: CommandConfig<
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
    infer GlobalOpts
  > ? Context & BaseContext
  : BaseContext;
