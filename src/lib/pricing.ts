import { percentOf } from "./money";

/** Pure pricing engine — no IO, fully unit tested in tests/pricing.test.ts. */

export type PricingLine = {
  productId: string;
  categoryId: string | null;
  quantity: number;
  unitPrice: number;
  addonsTotal: number;
};

export type CouponRules = {
  id: string;
  code: string;
  type: string; // fixed | percent | free_shipping
  value: number;
  minSpend: number;
  maxDiscount: number | null;
  freeShipping: boolean;
  appliesTo: string; // all | products | categories
  productIds: string[];
  categoryIds: string[];
};

export type Totals = {
  subtotal: number;
  addonsTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  freeShippingApplied: boolean;
  taxRateBp: number;
};

export type ShippingRules = {
  fee: number;
  freeThreshold: number;
  taxRateBp: number;
  pricesIncludeTax: boolean;
};

export function lineTotal(line: PricingLine): number {
  return (line.unitPrice + line.addonsTotal) * line.quantity;
}

export function cartSubtotal(lines: PricingLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

export function cartAddonsTotal(lines: PricingLine[]): number {
  return lines.reduce((sum, line) => sum + line.addonsTotal * line.quantity, 0);
}

/**
 * Discount is computed only on eligible lines, after quantity multiplication,
 * and never exceeds the merchandise subtotal.
 */
export function computeDiscount(
  lines: PricingLine[],
  coupon: CouponRules | null,
): { discount: number; eligibleSubtotal: number } {
  if (!coupon) return { discount: 0, eligibleSubtotal: 0 };
  const eligible = lines.filter((line) => {
    if (coupon.appliesTo === "products") return coupon.productIds.includes(line.productId);
    if (coupon.appliesTo === "categories") {
      return line.categoryId !== null && coupon.categoryIds.includes(line.categoryId);
    }
    return true;
  });
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (eligibleSubtotal <= 0) return { discount: 0, eligibleSubtotal: 0 };

  if (coupon.type === "free_shipping") return { discount: 0, eligibleSubtotal };

  let discount = 0;
  if (coupon.type === "percent") {
    discount = percentOf(eligibleSubtotal, Math.min(10000, Math.max(0, coupon.value)));
    if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = Math.min(Math.max(0, coupon.value), eligibleSubtotal);
  }
  return { discount, eligibleSubtotal };
}

export function computeTotals(
  lines: PricingLine[],
  coupon: CouponRules | null,
  shipping: ShippingRules,
): Totals {
  const subtotal = cartSubtotal(lines);
  const addonsTotal = cartAddonsTotal(lines);
  const merchandise = subtotal + addonsTotal;
  const { discount } = computeDiscount(lines, coupon);

  const couponFreeShipping = coupon?.type === "free_shipping" || coupon?.freeShipping === true;
  const thresholdReached = shipping.freeThreshold > 0 && merchandise >= shipping.freeThreshold;
  const freeShippingApplied = couponFreeShipping || thresholdReached;
  const shippingTotal = lines.length === 0 || freeShippingApplied ? 0 : shipping.fee;

  const discountedMerchandise = Math.max(0, merchandise - discount);
  // When prices include VAT, tax is the VAT portion of the total (informational,
  // already inside the displayed price). Otherwise it is added on top.
  const taxTotal = shipping.pricesIncludeTax
    ? Math.round(
        ((discountedMerchandise + shippingTotal) * shipping.taxRateBp) / (10000 + shipping.taxRateBp),
      )
    : Math.round((discountedMerchandise * shipping.taxRateBp) / 10000);

  const grandTotal = shipping.pricesIncludeTax
    ? discountedMerchandise + shippingTotal
    : discountedMerchandise + shippingTotal + taxTotal;

  return {
    subtotal,
    addonsTotal,
    discountTotal: discount,
    shippingTotal,
    taxTotal,
    grandTotal: Math.max(0, grandTotal),
    freeShippingApplied,
    taxRateBp: shipping.taxRateBp,
  };
}

/** Total quantity of merchandise in the cart (badge counter). */
export function cartCount(lines: Array<{ quantity: number }>): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export type LimitReason =
  | "unavailable"
  | "out_of_stock"
  | "insufficient_stock"
  | "price_changed"
  | "variant_unavailable"
  | "addon_unavailable"
  | "max_quantity";

export type LineIssue = { code: LimitReason; message: string; severity: "error" | "warning" };

export const MAX_QTY_PER_LINE = 20;
