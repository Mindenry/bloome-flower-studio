import { describe, expect, it } from "vitest";
import { computeTotals, computeDiscount, type CouponRules, type PricingLine } from "../src/lib/pricing";

const line = (overrides: Partial<PricingLine> = {}): PricingLine => ({
  productId: "p1",
  categoryId: "c1",
  quantity: 1,
  unitPrice: 100_000, // THB 1,000
  addonsTotal: 0,
  ...overrides,
});

const coupon = (overrides: Partial<CouponRules> = {}): CouponRules => ({
  id: "cpn",
  code: "TEST",
  type: "percent",
  value: 1000, // 10%
  minSpend: 0,
  maxDiscount: null,
  freeShipping: false,
  appliesTo: "all",
  productIds: [],
  categoryIds: [],
  ...overrides,
});

const shipping = { fee: 15_000, freeThreshold: 150_000, taxRateBp: 700, pricesIncludeTax: true };

describe("computeDiscount", () => {
  it("applies a percentage discount to merchandise only", () => {
    const result = computeDiscount([line({ quantity: 2, addonsTotal: 20_000 })], coupon());
    expect(result.eligibleSubtotal).toBe(200_000);
    expect(result.discount).toBe(20_000);
  });

  it("caps percentage discounts at maxDiscount", () => {
    const result = computeDiscount([line({ quantity: 3 })], coupon({ maxDiscount: 15_000 }));
    expect(result.discount).toBe(15_000);
  });

  it("restricts discounts to specific products", () => {
    const lines = [line({ productId: "p1" }), line({ productId: "p2" })];
    const result = computeDiscount(lines, coupon({ appliesTo: "products", productIds: ["p2"] }));
    expect(result.eligibleSubtotal).toBe(100_000);
    expect(result.discount).toBe(10_000);
  });

  it("restricts discounts to categories", () => {
    const lines = [line({ categoryId: "c1" }), line({ categoryId: "c2" })];
    const result = computeDiscount(lines, coupon({ appliesTo: "categories", categoryIds: ["c2"] }));
    expect(result.discount).toBe(10_000);
  });

  it("never discounts more than the eligible subtotal", () => {
    const result = computeDiscount([line({ unitPrice: 5_000 })], coupon({ type: "fixed", value: 50_000 }));
    expect(result.discount).toBe(5_000);
  });

  it("returns zero for empty carts", () => {
    expect(computeDiscount([], coupon())).toEqual({ discount: 0, eligibleSubtotal: 0 });
  });
});

describe("computeTotals", () => {
  it("adds shipping below the free threshold", () => {
    const totals = computeTotals([line()], null, shipping);
    expect(totals.shippingTotal).toBe(15_000);
    expect(totals.grandTotal).toBe(115_000);
  });

  it("waives shipping when the threshold is met", () => {
    const totals = computeTotals([line({ quantity: 2 })], null, shipping);
    expect(totals.freeShippingApplied).toBe(true);
    expect(totals.shippingTotal).toBe(0);
  });

  it("waives shipping for free-shipping coupons", () => {
    const totals = computeTotals([line()], coupon({ type: "free_shipping", freeShipping: true }), shipping);
    expect(totals.freeShippingApplied).toBe(true);
    expect(totals.shippingTotal).toBe(0);
    expect(totals.discountTotal).toBe(0);
  });

  it("reports VAT included inside the displayed price", () => {
    const totals = computeTotals([line()], null, shipping);
    expect(totals.taxTotal).toBe(Math.round((115_000 * 700) / 10_700));
    expect(totals.grandTotal).toBe(115_000);
  });

  it("adds VAT on top when prices exclude tax", () => {
    const totals = computeTotals([line()], null, { ...shipping, pricesIncludeTax: false });
    expect(totals.grandTotal).toBe(122_000);
  });

  it("applies add-on totals per quantity", () => {
    const totals = computeTotals([line({ quantity: 2, addonsTotal: 25_000 })], null, shipping);
    expect(totals.subtotal).toBe(200_000);
    expect(totals.addonsTotal).toBe(50_000);
    expect(totals.grandTotal).toBe(250_000);
  });

  it("returns zero totals for an empty cart", () => {
    const totals = computeTotals([], null, shipping);
    expect(totals.grandTotal).toBe(0);
    expect(totals.shippingTotal).toBe(0);
  });
});
