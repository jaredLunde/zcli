import { Cmd, cmd, CmdConfig } from "./cmd.ts";
import { Arg, arg, args, ArgsTuple } from "./arg.ts";
import { help, helpOpt } from "./help.ts";
import { opt, opts, OptsObject } from "./opt.ts";
import { z } from "./z.ts";

export function create<Context extends Record<string, unknown>>(
  config: CreateConfig<Context>,
) {
  return {
    arg,
    args,
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
      options: CmdConfig<Context, Args, Opts>,
    ): Cmd<Context, Args, Opts> {
      const command = cmd<Context, Args, Opts>(name, options);
      const parse = command.parse;

      return Object.assign(command, {
        parse: (args: string[], ctx?: Context) => {
          return parse(args, ctx ?? config.ctx);
        },
      });
    },
    help,
    helpOpt,
    opt,
    opts,
  };
}
export type CreateConfig<Context extends Record<string, unknown>> = {
  ctx?: Context;
};
