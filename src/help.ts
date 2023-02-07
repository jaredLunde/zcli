// deno-lint-ignore-file no-explicit-any
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import { Arg } from "./arg.ts";
import { cmd } from "./cmd.ts";
import { Opt, opt } from "./opt.ts";

export const SHOW_HELP = Symbol("SHOW_HELP");

export function help() {
  return z
    .boolean()
    .refine(
      (value) => {
        return !value;
      },
      {
        message: "Show help",
        params: {
          interrupt: SHOW_HELP,
        },
      }
    )
    .default(false);
}

export function helpOpt() {
  return opt(help(), { aliases: ["h"] });
}

export function showHelp() {
  throw new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      message: "Show help",
      path: [],
      params: {
        interrupt: SHOW_HELP,
      },
    },
  ]);
}

export function helpCmd<
  Context extends Record<string, unknown> | undefined,
  Args extends
    | z.ZodTuple<[Arg<any, any>, ...Arg<any, any>[]]>
    | z.ZodTuple<[Arg<any, any>, ...Arg<any, any>[]], Arg<any, any>>,
  Opts extends
    | z.ZodObject<Record<string, Opt<z.ZodSchema<any>, string>>, "strict">
    | z.ZodUnion<
        [
          z.ZodObject<Record<string, Opt<z.ZodSchema<any>, string>>, "strict">,
          ...z.ZodObject<
            Record<string, Opt<z.ZodSchema<any>, string>>,
            "strict"
          >[]
        ]
      >
>(config: {
  args?: Args;
  opts?: Opts;
  run?: (argopts: any, ctx: Context) => Promise<void> | void;
}) {
  return cmd("help", {
    run() {
      showHelp();
    },
    ...config,
  });
}
