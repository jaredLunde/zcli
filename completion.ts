// deno-lint-ignore-file no-explicit-any no-explicit-any
import { textEncoder } from "./lib/text-encoder.ts";
import { CommandFactory } from "./init.ts";
import { flag, Flags, flags } from "./flags.ts";
import * as bash from "./completions/bash.ts";
import * as fish from "./completions/fish.ts";
import * as zsh from "./completions/zsh.ts";
import { CommandConfig, DefaultContext } from "./command.ts";
import { writeIterable } from "./lib/write-iterable.ts";

const shellCommandFlags = flags({
  "no-descriptions": flag({
    short: "Disable completion descriptions",
  }).boolean().default(false),
});

export function completion<
  Context extends Record<string, unknown>,
  GlobalOpts extends Flags,
>(
  commandFactory: CommandFactory<Context, GlobalOpts>,
  options:
    & {
      /**
       * Change the name of the command
       * @default "completion"
       */
      name?: string;
    }
    & Pick<
      CommandConfig<Context & DefaultContext, any, any>,
      "aliases" | "short" | "long" | "use" | "hidden"
    > = {},
) {
  const { name = "completion", ...config } = options;

  const command = commandFactory.command(name, {
    short: "Generate an autocompletion script for the specified shell",
    long: ({ root }) => `
      Generate an autocompletion script for ${root.name} in the specified shell.
      See each sub-command's help for details on how to use the generated script.
    `,
    ...config,
    commands: [
      commandFactory.command("bash", {
        short: "Generate an autocompletion script for the bash shell",
        long: ({ root }) => `
          Generate the autocompletion script for the bash shell.

          This script depends on the 'bash-completion' package.
          If it is not installed already, you can install it via your OS's package manager.

          To load completions in your current shell session:
          \`\`\`
          $ source <(${root.name} ${name} bash)
          \`\`\`

          To load completions for every new session, execute once:
          
          Linux:
          \`\`\`
          $ ${root.name} ${name} bash > /etc/bash_completion.d/${root.name}
          \`\`\`

          MacOS:
          \`\`\`
          $ ${root.name} ${name} bash > /usr/local/etc/bash_completion.d/${root.name}
          \`\`\`

          You will need to start a new shell for this setup to take effect.
        `,
      }).run(function ({ ctx }) {
        write(bash.complete(ctx.root));
      }),
      commandFactory.command("zsh", {
        short: "Generate an autocompletion script for the zsh shell",
        long: ({ root }) => `
          Generate the autocompletion script for the zsh shell.

          If shell completion is not already enabled in your environment you will need
          to enable it.  You can execute the following once:
          
          \`\`\`
          $ echo "autoload -U compinit; compinit" >> ~/.zshrc
          \`\`\`

          To load completions for every new session, execute once:

          Linux:
          \`\`\`
          $ ${root.name} ${name} zsh > "\${fpath[1]}/_${root.name}"
          \`\`\`

          macOS:
          \`\`\`
          $ ${root.name} ${name} zsh > /usr/local/share/zsh/site-functions/_${root.name}
          \`\`\`

          Oh My Zsh:
          \`\`\`
          $ ${root.name} ${name} zsh > ~/.oh-my-zsh/completions/_${root.name}
          \`\`\`

          You will need to start a new shell for this setup to take effect.
        `,
        flags: shellCommandFlags,
      }).run(function ({ flags, ctx }) {
        write(
          zsh.complete(ctx.root, {
            ctx,
            // @ts-expect-error: it's fine
            disableDescriptions: flags["no-descriptions"],
          }),
        );
      }),
      commandFactory.command("fish", {
        short: "Generate an autocompletion script for the fish shell",
        long: ({ root }) => `
          Generate the autocompletion script for the fish shell.
          
          To load completions in your current shell session:
          \`\`\`
          $ ${root.name} ${name} fish | source
          \`\`\`

          To load completions for every new session, execute once:
          \`\`\`
          $ ${root.name} ${name} fish > ~/.config/fish/completions/${root.name}.fish
          \`\`\`

          You will need to start a new shell for this setup to take effect.
        `,
        flags: shellCommandFlags,
      }).run(function ({ flags, ctx }) {
        write(
          fish.complete(ctx.root, {
            ctx,
            // @ts-expect-error: it's fine
            disableDescriptions: flags["no-descriptions"],
          }),
        );
      }),
    ],
  })
    .run(async ({ ctx }) => {
      await writeIterable(command.help(ctx as any));
    });

  return command;
}

export async function write(stream: Iterable<string>): Promise<void> {
  const writes: Promise<number>[] = [];

  for (const line of stream) {
    writes.push(Deno.stdout.write(textEncoder.encode(line + "\n")));
  }

  await Promise.all(writes);
  Deno.exit(0);
}
