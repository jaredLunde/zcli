// deno-lint-ignore-file no-explicit-any
import { Cmd, cmd, CmdConfig } from "./cmd.ts";
import { Arg, arg, args, ArgsTuple } from "./arg.ts";
import { helpOpt, writeHelp } from "./help.ts";
import { GlobalOptsObject, opt, opts, OptsObject } from "./opt.ts";
import { z } from "./z.ts";
import { didYouMean } from "./lib/did-you-mean.ts";
import { colors } from "./fmt.ts";
import { table } from "./lib/simple-table.ts";
import * as intl from "./intl.ts";

export function create<
  Context extends Record<string, unknown>,
  GlobalOpts extends GlobalOptsObject,
>(config: CreateConfig<Context, GlobalOpts>) {
  const gOpts = config.globalOpts
    ? config.globalOpts.merge(helpOpts)
    : helpOpts;

  return {
    cmd<
      Args extends
        | ArgsTuple<
          Arg<string, z.ZodTypeAny>,
          Arg<string, z.ZodTypeAny>[],
          Arg<string, z.ZodTypeAny> | null
        >
        | unknown = unknown,
      Opts extends OptsObject | unknown = unknown,
    >(
      name: string,
      options: CmdConfig<Context & BaseContext, Args, Opts> = {},
    ): Cmd<Context & BaseContext, Args, Opts, GlobalOpts> {
      // @ts-expect-error: blah blah
      options.opts = options.opts ? options.opts.merge(gOpts) : gOpts;

      if (options.cmds?.length) {
        const helpCmd = cmd("help", {
          opts: options.opts,
          cmds: [
            this.cmd("commands", {
              opts: opts({
                all: opt(z.boolean().default(false), {
                  aliases: ["a"],
                }).describe("Show all commands, including hidden ones"),
              }),
            })
              .run(async (args) => {
                await writeHelp(
                  (function* listCommands() {
                    yield colors.bold(`${name} commands`);
                    const sortedCmds = intl.collate(
                      // @ts-expect-error: it's fine ffs
                      options.cmds!.filter((cmd) => args.all || !cmd.hidden),
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

          args: args([arg("command", z.string())]).optional(),
        })
          .describe(`Show help for a ${name} command`)
          .run(async (args: any, ctx) => {
            if (!args.command) {
              await writeHelp(command.help());
            }

            const cmd = options.cmds!.find(
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
                        .cmds!.flatMap((cmd) => [cmd.name, ...cmd.aliases])
                        .concat("commands"),
                    ) + "\n",
                  ),
                ),
              ]);

              Deno.exit(1);
            }

            await writeHelp(cmd.help((ctx.path ?? []).concat(cmd.name)));
          });

        const parse = helpCmd.parse;
        helpCmd.parse = (args: string[], ctx?: Context & BaseContext) => {
          return parse(
            args,
            // @ts-expect-error: it's cool
            {
              ...(ctx ?? config.ctx),
              path: args.includes("--help") || args.includes("-h")
                ? [...(ctx?.path ?? []), "help"]
                : ctx?.path,
            },
          );
        };
        // @ts-expect-error: it's fine ffs
        options.cmds = [...options.cmds, helpCmd];
      }

      const command = cmd<Context & BaseContext, Args, Opts>(name, options);
      const parse = command.parse;
      const parseOverride = {
        parse: (args: string[], ctx?: Context & BaseContext) => {
          return parse(
            args,
            // @ts-expect-error: it's cool
            {
              ...(ctx ?? config.ctx),
              path: [...(ctx?.path ?? []), name],
            },
          );
        },
      };

      // @ts-expect-error: it's fine ffs
      return Object.assign(command, parseOverride);
    },
  };
}

const helpOpts = opts({
  help: helpOpt().describe("Show help for this command"),
});

export type CreateConfig<
  Context extends Record<string, unknown>,
  GlobalOpts extends GlobalOptsObject,
> = {
  /**
   * The context that will be passed to each command.
   */
  ctx?: Context;
  /**
   * The global options that will be passed to each command.
   */
  globalOpts?: GlobalOpts;
};

export type BaseContext = {
  /**
   * The path of the command that is currently being parsed.
   */
  path: string[];
};

export type DefaultContext = BaseContext & Record<string, unknown>;
