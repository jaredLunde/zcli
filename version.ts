// deno-lint-ignore-file no-explicit-any
import { CommandFactory } from "./create.ts";
import * as intl from "./intl.ts";

export function version<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(commandFactory: CommandFactory<Context, any>, options: {
  /**
   * Change the name of the command
   * @default "version"
   */
  name?: string;
  /**
   * Add aliases for the command
   */
  aliases?: string[];
} = {}) {
  const { name = "version", ...config } = options;

  return commandFactory.command(name, config)
    .run(function* (_args, { meta, path }) {
      const bin = path[0];
      const metaStr = [
        meta.date &&
        `build date: ${
          intl.date(new Date(meta.date), {
            dateStyle: "medium",
            timeStyle: "short",
          })
        }`,
        meta.commit && `commit: ${meta.commit}`,
      ].filter(Boolean).join("; ");

      yield `${bin} v${meta.version}${
        metaStr.length > 1 ? ` (${metaStr})` : ""
      }`;
    })
    .describe("Show version information")
    .long(
      "Shows version information command, including version number and build date.",
    );
}
