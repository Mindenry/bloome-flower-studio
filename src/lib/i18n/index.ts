import { defaultLocale, type Locale } from "./config";
import { dictionaries, type TranslationKey } from "./dictionaries";

export type { TranslationKey };
export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

/** Translate with graceful fallback: locale → Thai → key. */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? dictionaries[defaultLocale];
  const value = dict[key] ?? dictionaries[defaultLocale][key] ?? key;
  return interpolate(value, params);
}

export function getT(locale: Locale): TFunction {
  return (key, params) => translate(locale, key, params);
}

export function translationExists(locale: Locale, key: string): boolean {
  return key in (dictionaries[locale] ?? {});
}
