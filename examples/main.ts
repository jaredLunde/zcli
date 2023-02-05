import { opt, arg } from "../src/mod.ts";
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import * as flags from "https://deno.land/std@0.175.0/flags/mod.ts";

const o = opt({
  name: "port",
  schema: z.string().transform((v) => parseInt(v, 10)),
});

if (import.meta.main) {
  const f = flags.parse<Record<string, unknown>>(Deno.args);

  console.log(f);
}
