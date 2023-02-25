# zCLI

> A framework for building type-safe command-line tools powered by Zod

## Features

- [x] Zod validations for POSIX-compliant flags and arguments
- [x] Declarative API
- [x] S-tier type-safety and autocomplete
- [x] Built-in `help` command and `--help` flag
- [x] Built-in `version` command
- [x] Built-in `completion` command for Bash, Fish, and Zsh
- [x] Type-safe, persistent configuration
- [x] Type-safe, persistent key-value cache
- [x] Type-safe environment variables
- [x] Built-in internationalization using the user's locale and Deno's `Intl`
      API
- [x] Global flags
- [x] Automated README generation
- [x] Command and flag aliases
- [x] `persistentPreRun`, `preRun` and `postRun` hooks

## Getting started

The easiest way to get started is to use the
[`zCLI CLI`](https://github.com/jaredLunde/zcli-cli) to generate a new project.

```sh
# Install the zCLI CLI
curl -fsSL https://raw.githubusercontent.com/jaredLunde/zcli-cli/main/install.sh | sh

# Create a new project
zcli init my-project

# Add a command
zcli add my-command
```

## Example usage

```ts
import { args, env, flag, flags, init } from "https://deno.land/x/zcli/mod.ts";
import { z } from "https://deno.land/x/zcli/z.ts";

const cli = init({
  globalFlags: flags({
    verbose: flag({ aliases: ["v"] }).oboolean(),
    raw: flag({ aliases: ["r"] }).oboolean(),
  }),

  ctx: {
    env: env({
      DEBUG: env.bool().default("false"),
    }),

    meta: {
      version: "1.3.2",
      build: Deno.build,
      commit: "development",
      date: new Date().toISOString(),
    },
  },
});

const fetcher = cli
  .command("fetcher", {
    args: args({
      short: "The URL to fetch",
    }).tuple([z.string().url()]),

    flags: flags({
      method: flag({ short: "The HTTP method to use", aliases: ["m"] })
        .enum(["POST", "GET", "PUT", "PATCH", "DELETE", "HEAD"])
        .default("GET"),
      headers: flag({ short: "Add headers to the request", aliases: ["H"] })
        .array(z.string())
        .optional(),
      data: flag({
        short: "Send request data",
        aliases: ["d"],
      }).ostring(),
    }),
  })
  .describe("Fetch a resource from the internet")
  .preRun(({ flags, ctx }) => {
    if (ctx.env.get("DEBUG")) {
      console.log("Fetching:", flags.url);
    }
  })
  .run(async ({ flags, ctx }) => {
    if (ctx.env.get("DEBUG")) {
      console.log("Fetching:", flags.url);
    }

    const response = await fetch(flags.url, {
      method: flags.method,
      headers: new Headers(
        flags.headers?.map((h) => h.split(":").map((s) => s.trim())),
      ),
      body: flags.data,
    });

    if (flags.json) {
      console.log(await response.json());
    } else {
      console.log("Response:", response);
    }
  });

if (import.meta.main) {
  await fetcher.execute();
}
```

## The problem

Command-line tools written in Node and Deno suffer from a few major issues:

- They are difficult to test
- They are difficult to type
- Their boot time is slow
- Distribution is difficult

## The solution

This framework aims to solve these issues by providing a declarative, simple API
for building type-safe commandline tools using Zod and Deno. It is largely
inspired by what [tRPC](https://trpc.io) did for RPC APIs, hence the nod to the
name.

Deno was chosen as the runtime because it is fast, secure, and has a great
standard library. It also has a great testing story and is easy to distribute,
as you can use `deno compile` to create a single binary. In the future, we may
also support compiling with `bun` to create a single binary.

Inherent boot performance is achieved by limiting the amount of code that is
bundled into the binary. The flags parser is also about 7x faster than the Deno
standard library's parser, though this amounts to a small fraction of the total
boot/execution time.

```
benchmark          time (avg)             (min … max)       p75       p99      p995
----------------------------------------------------- -----------------------------
zcli.parse()     1.08 µs/iter   (986.08 ns … 1.37 µs)   1.11 µs   1.37 µs   1.37 µs
flags.parse()    7.69 µs/iter     (5.22 µs … 6.15 ms)   6.17 µs  19.37 µs  48.85 µs

summary
  zcli.parse()
   7.11x faster than flags.parse()
```
