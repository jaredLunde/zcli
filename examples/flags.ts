import { parse } from "../src/flags-parser.ts";

if (import.meta.main) {
  const args = parse(Deno.args, {
    bools: { debug: true },
    numbers: { port: true },
    aliases: { d: "debug" },
    collect: {},
    negatable: {},
  });

  console.log(args);
}
