import { CommandFactory } from "./create.ts";
import { flag, Flags, flags } from "./flags.ts";
import * as bash from "./completions/bash.ts";
import * as fish from "./completions/fish.ts";
import * as zsh from "./completions/zsh.ts";
import { writeHelp } from "./help.ts";

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
  options: {
    /**
     * Change the name of the command
     * @default "completion"
     */
    name?: string;
    /**
     * Add aliases for the command
     */
    aliases?: string[];
  } = {},
) {
  const { name = "completion", aliases } = options;
  const bin = () => commandFactory.bin?.name ?? "[bin]";

  const command = commandFactory.command(name, {
    short: "Generate an autocompletion script for the specified shell",
    long: () => `
      Generate an autocompletion script for ${bin()} in the specified shell.
      See each sub-command's help for details on how to use the generated script.
    `,
    aliases,
    commands: [
      commandFactory.command("bash", {
        short: () => "Generate an autocompletion script for the bash shell",
        long: () => `
          Generate the autocompletion script for the bash shell.

          This script depends on the 'bash-completion' package.
          If it is not installed already, you can install it via your OS's package manager.

          To load completions in your current shell session:
          $ source <(${bin()} ${name} bash)

          To load completions for every new session, execute once:
          
          Linux:
            $ ${bin()} ${name} bash > /etc/bash_completion.d/${bin()}
            
          MacOS:
            $ ${bin()} ${name} bash > /usr/local/etc/bash_completion.d/${bin()}

          You will need to start a new shell for this setup to take effect.
        `,
      }).run(function ({ ctx }) {
        write(bash.complete(ctx.bin));
      }),
      commandFactory.command("zsh", {
        short: "Generate an autocompletion script for the zsh shell",
        long: () => `
          Generate the autocompletion script for the zsh shell.

          If shell completion is not already enabled in your environment you will need
          to enable it.  You can execute the following once:
          
          $ echo "autoload -U compinit; compinit" >> ~/.zshrc
          
          To load completions for every new session, execute once:

          # Linux:
          $ ${bin()} ${name} zsh > "\${fpath[1]}/_${bin()}"
          
          # macOS:
          $ ${bin()} ${name} zsh > /usr/local/share/zsh/site-functions/_${bin()}

          # Oh My Zsh
          $ ${bin()} ${name} zsh > ~/.oh-my-zsh/completions/_${bin()}
          
          You will need to start a new shell for this setup to take effect.
        `,
        flags: shellCommandFlags,
      }).run(function ({ flags, ctx }) {
        write(
          zsh.complete(ctx.bin, {
            // @ts-expect-error: it's fine
            disableDescriptions: flags["no-descriptions"],
          }),
        );
      }),
      commandFactory.command("fish", {
        short: "Generate an autocompletion script for the fish shell",
        long: () => `
          Generate the autocompletion script for the fish shell.
          
          To load completions in your current shell session:
          $ ${bin()} ${name} fish | source

          To load completions for every new session, execute once:
          $ ${bin()} ${name} fish > ~/.config/fish/completions/${bin()}.fish

          You will need to start a new shell for this setup to take effect.
        `,
        flags: shellCommandFlags,
      }).run(function ({ flags, ctx }) {
        write(
          fish.complete(ctx.bin, {
            // @ts-expect-error: it's fine
            disableDescriptions: flags["no-descriptions"],
          }),
        );
      }),
    ],
  })
    .run(async ({ ctx }) => {
      await writeHelp(command.help(ctx.path));
    });

  return command;
}

const encoder = new TextEncoder();

export async function write(stream: Iterable<string>): Promise<void> {
  const writes: Promise<number>[] = [];

  for (const line of stream) {
    writes.push(Deno.stdout.write(encoder.encode(line + "\n")));
  }

  await Promise.all(writes);
  Deno.exit(0);
}
