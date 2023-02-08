import { z } from "./z.ts";
import { opt } from "./opt.ts";

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
