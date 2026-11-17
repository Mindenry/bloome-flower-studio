/**
 * Money is always stored and calculated in the smallest currency unit (satang).
 * Never use floating point for money.
 */
export const CURRENCY = "THB";
export const CURRENCY_LOCALE: Record<string, string> = { THB: "th-TH" };

export function toMinor(amount: number | string): number {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

export function formatMoney(
  minor: number,
  options: { locale?: string; currency?: string; withSymbol?: boolean } = {},
): string {
  const locale = options.locale === "en" ? "en-US" : "th-TH";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(fromMinor(minor));
  if (options.withSymbol === false) return formatted;
  const currency = options.currency ?? CURRENCY;
  const symbol = currency === "THB" ? "฿" : `${currency} `;
  return `${symbol}${formatted}`;
}

export function formatMoneyEn(minor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(fromMinor(minor));
}

/** Round to satang, guarding against NaN. */
export function safeMinor(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export function percentOf(minor: number, basisPoints: number): number {
  return Math.round((minor * basisPoints) / 10000);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
