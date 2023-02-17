export function shorten(text: string) {
  return text.trim().split("\n", 1)[0].trim();
}
