/**
 * A default locale to use for Internationalization (I18n) when
 * formatting messages.
 */
export const locale = (
  Deno.env.get("LANGUAGE") ||
  Deno.env.get("LANG") ||
  Deno.env.get("LC_ALL") ||
  "en_US.UTF-8"
)
  .split(":")[0]
  .split(".")[0]
  .replace("_", "-");
