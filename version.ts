// deno-lint-ignore-file no-explicit-any
import { BaseContext, CommandConfig } from "./command.ts";
import { CommandFactory } from "./init.ts";
import * as intl from "./intl.ts";

export function version<
  Context extends {
    meta: { version: string; date?: string; commit?: string };
  },
>(commandFactory: CommandFactory<Context, any>, options:
  & {
    /**
     * Change the name of the command
     * @default "version"
     */
    name?: string;
  }
  & Pick<
    CommandConfig<Context & BaseContext, any, any>,
    "aliases" | "short" | "long" | "use" | "hidden"
  > = {}) {
  const { name = "version", ...config } = options;

  return commandFactory.command(name, {
    short: "Show version information",
    long:
      "Shows version information command, including version number and build date.",
    ...config,
  })
    .run(function* ({ ctx: { meta, path } }) {
      const bin = path[0];

      const metaStr = [
        meta.date &&
        `build date: ${
          intl.date(
            new Date(meta.date),
            {
              dateStyle: "medium",
              timeStyle: "short",
            },
          )
        }`,
        meta.commit && `commit: ${meta.commit}`,
      ].filter(Boolean).join("; ");

      yield `${bin} v${meta.version}${
        metaStr.length > 1 ? ` (${metaStr})` : ""
      }`;
    });
}
