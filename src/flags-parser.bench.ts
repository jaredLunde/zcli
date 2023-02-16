import { parse } from "./flags-parser.ts";
import * as flags from "https://deno.land/std@0.177.0/flags/mod.ts";

console.log(
  parse(
    [
      "build",
      "--bundle",
      "-rf",
      "--a",
      "value",
      "--b=value",
      "--c",
      "1",
      "-e1e7",
    ],
    {
      bools: { debug: true, r: true },
      numbers: { port: true, e: true },
      aliases: { d: "debug" },
      collect: { port: true },
      negatable: { debug: true },
    },
  ),
);

console.log(
  flags.parse(
    [
      "build",
      "--bundle",
      "-rf",
      "--a",
      "value",
      "--b=value",
      "--c",
      "1",
      "-e1e7",
    ],
    {
      boolean: ["debug", "r"],
      alias: { debug: ["d"] },
      collect: ["port"],
      negatable: ["debug"],
      "--": true,
    },
  ),
);

Deno.bench("zcli.parse()", { group: "parser", baseline: true }, () => {
  parse(["build", "--bundle", "-rf", "--a", "value", "--b=value", "--c", "1"], {
    bools: { debug: true, help: true },
    numbers: { port: true },
    aliases: { h: "help" },
    collect: { port: true },
    negatable: { debug: true },
  });
});

Deno.bench("flags.parse()", { group: "parser" }, () => {
  flags.parse(
    ["build", "--bundle", "-rf", "--a", "value", "--b=value", "--c", "1"],
    {
      boolean: ["debug", "help"],
      alias: { debug: ["d"], help: ["h"] },
      collect: ["port"],
      negatable: ["debug"],
    },
  );
});
