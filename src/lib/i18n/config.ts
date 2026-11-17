export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "th" || value === "en";
}

export function asLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "th" ? "en" : "th";
}

export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/") return `/${locale}`;
  return `/${locale}${clean}`;
}

/** Swaps the locale segment of a pathname: /th/shop -> /en/shop */
export function swapLocalePath(pathname: string, locale: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  if (isLocale(parts[0])) parts[0] = locale;
  else parts.unshift(locale);
  return `/${parts.join("/")}`;
}

export const localeNames: Record<Locale, string> = { th: "ไทย", en: "English" };
export const localeShort: Record<Locale, string> = { th: "TH", en: "EN" };
export const htmlLang: Record<Locale, string> = { th: "th", en: "en" };
export const ogLocale: Record<Locale, string> = { th: "th_TH", en: "en_US" };
