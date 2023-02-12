import { locale as defaultLocale } from "./locale.ts";

export function plural(
  amount: number,
  singular: string,
  options: {
    locale?: string;
    plural?: string;
    hideCount?: boolean;
  } = {}
) {
  const {
    locale = defaultLocale,
    plural = singular + "s",
    hideCount,
  } = options;
  const pluralRules = new Intl.PluralRules(locale);
  const pluralForm = pluralRules.select(amount);
  return [!hideCount && amount, pluralForm === "one" ? singular : plural]
    .filter(Boolean)
    .join(" ");
}

export function list(
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

export function relativeTime(
  date: Date,
  options: {
    style?: Intl.RelativeTimeFormatOptions["style"];
    locale?: string;
  } = {}
): string {
  const { style: length = "long", locale = defaultLocale } = options;
  const rtf = new Intl.RelativeTimeFormat(locale, {
    style: length,
    numeric: "auto",
  });

  let delta = (date.getTime() - Date.now()) / 1000;

  for (let i = 0; i <= units.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const unit = units[i]!;
    delta = Math.round(delta);

    if (Math.abs(delta) < unit.amount) {
      return rtf.format(delta, unit.name);
    }

    delta /= unit.amount;
  }

  return "";
}

export function relativeTimeFormat(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions & {
    locale?: string;
  } = {}
): string {
  const { locale = defaultLocale, ...formatOptions } = options;
  return new Intl.RelativeTimeFormat(locale, formatOptions).format(value, unit);
}

export function currency(
  value: number,
  options: Omit<Intl.NumberFormatOptions, "currency"> & {
    currency?: string;
    locale?: string;
  } = {}
): string {
  const { locale, ...formatOptions } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    ...formatOptions,
  }).format(value);
}

export function date(
  date: Date,
  options: Intl.DateTimeFormatOptions & {
    locale?: string;
  } = {}
): string {
  const { locale, ...formatOptions } = options;
  return new Intl.DateTimeFormat(locale, formatOptions).format(date);
}

export function range(
  start: number,
  end: number,
  options: Intl.NumberFormatOptions & {
    locale?: string;
  } = {}
): string {
  const { locale, ...formatOptions } = options;
  return new Intl.NumberFormat(locale, formatOptions).formatRange(start, end);
}

const units = [
  { amount: 60, name: "second" },
  { amount: 60, name: "minute" },
  { amount: 24, name: "hour" },
  { amount: 7, name: "day" },
  { amount: Math.floor(52 / 12), name: "week" },
  { amount: 12, name: "month" },
  { amount: Number.POSITIVE_INFINITY, name: "year" },
] as const;
