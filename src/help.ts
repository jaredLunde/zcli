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

export function isHelp(err: unknown): boolean {
  if (err instanceof z.ZodError) {
    const issue = err.issues.find(
      (issue) =>
        "params" in issue &&
        // @ts-expect-error: blah blah
        "interrupt" in issue.params &&
        issue.params.interrupt === SHOW_HELP
    );

    if (issue) {
      return true;
    }
  }

  return false;
}

export async function writeHelp(help: Iterable<string>): Promise<void> {
  const writes: Promise<number>[] = [];
  const text = new TextEncoder();

  for (const line of help) {
    writes.push(Deno.stdout.write(text.encode(line + "\n")));
  }

  await Promise.all(writes);
  Deno.exit(0);
}
