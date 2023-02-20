import { textEncoder } from "./text-encoder.ts";

export async function writeIterable(help: Iterable<string>): Promise<void> {
  const writes: Promise<number>[] = [];

  for (const line of help) {
    writes.push(Deno.stdout.write(textEncoder.encode(line + "\n")));
  }

  await Promise.all(writes);
  Deno.exit(0);
}
