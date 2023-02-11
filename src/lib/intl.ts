import { locale as defaultLocale } from "../locale.ts";

export function pluralForm(
  amount: number,
  singular: string,
  options: {
    locale?: string;
    plural?: string;
  } = {}
) {
  const { locale = defaultLocale, plural = singular + "s" } = options;
  const pluralRules = new Intl.PluralRules(locale);
  const pluralForm = pluralRules.select(amount);
  return `${amount} ${pluralForm === "one" ? singular : plural}`;
}

export function formatList(
  items: string[],
  options: Intl.ListFormatOptions & {
    locale?: string;
  } = {}
) {
  const { locale = defaultLocale, ...formatOptions } = options;
  const listFormatter = new Intl.ListFormat(locale, formatOptions);
  return listFormatter.format(items);
}

export function collate<T>(
  items: T[],
  options: Intl.CollatorOptions & {
    locale?: string;
    get?: (item: T) => string;
  } = {}
): T[] {
  const {
    locale = defaultLocale,
    get = (item) => "" + item,
    ...collatorOptions
  } = options;
  const collator = new Intl.Collator(locale, collatorOptions);
  return [...items].sort((a, b) => collator.compare(get(a), get(b)));
}
