import { closest } from "https://deno.land/x/fastest_levenshtein@1.0.10/mod.ts";

/**
 * Returns a string that suggests the closest match to the input string.
 *
 * @param input - The input string
 * @param possibilities - The list of possible strings
 */
export function didYouMean(input: string, possibilities: string[]): string {
  if (!possibilities.length) {
    return "";
  }

  const maybe = closest(input, possibilities);
  return `⚘ Did you mean "${maybe}"?`;
}
