import * as flags from "https://deno.land/std@0.177.0/flags/mod.ts";

if (import.meta.main) {
  const args = flags.parse(Deno.args, {
    boolean: ["debug"],
    string: ["path"],
    "--": true,
  });

  console.log(args);
}
