import type { Locale } from "./i18n/config";

export const BANGKOK_TZ = "Asia/Bangkok";

/** YYYY-MM-DD in Asia/Bangkok regardless of server timezone. */
export function bangkokDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function bangkokTimeParts(date: Date = new Date()): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { hours: get("hour"), minutes: get("minute") };
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return bangkokDateString(date);
}

export function compareDateStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Sunday … 6 = Saturday, computed for a Bangkok calendar date. */
export function weekdayOfDateString(dateStr: string): number {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  return date.getUTCDay();
}

export function formatDate(
  value: string | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: BANGKOK_TZ,
    ...options,
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  return formatDate(value, locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateOnly(value: string, locale: Locale): string {
  return formatDate(`${value}T12:00:00+07:00`, locale, { dateStyle: "full" });
}

export function relativeTime(iso: string, locale: Locale): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale === "th" ? "th" : "en", { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

export function countdownParts(msRemaining: number): { minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}
