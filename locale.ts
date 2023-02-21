/**
 * A default locale to use for Internationalization (I18n) when
 * formatting messages.
 */
let envLocale = (
  Deno.env.get("LANGUAGE") ||
  Deno.env.get("LANG") ||
  Deno.env.get("LC_ALL") ||
  "en_US.UTF-8"
)
  .split(":")[0]
  .split(".")[0]
  .replace("_", "-");

try {
  envLocale = new Intl.Locale(envLocale) + "";
} catch (_err) {
  envLocale = "en-US";
}

export const locale = envLocale;
