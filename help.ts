import { z } from "./z.ts";
import { flag, FlagConfig } from "./flags.ts";

export const SHOW_HELP = Symbol("SHOW_HELP");

export function helpFlag(config: FlagConfig = {}) {
  return flag({ aliases: ["h"], ...config }).ostring()
    .refine(
      (value) => {
        return typeof value === "undefined";
      },
      {
        message: "Show help",
        params: {
          interrupt: SHOW_HELP,
        },
      },
    );
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

export function isHelp(err: unknown): boolean {
  if (err instanceof z.ZodError) {
    const issue = err.issues.find(
      (issue) =>
        "params" in issue &&
        // @ts-expect-error: blah blah
        "interrupt" in issue.params &&
        issue.params.interrupt === SHOW_HELP,
    );

    if (issue) {
      return true;
    }
  }

  return false;
}
