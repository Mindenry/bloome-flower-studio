import { describe, expect, it } from "vitest";
import { formatMoney, fromMinor, percentOf, safeMinor, toMinor } from "../src/lib/money";
import { dictionaries, th } from "../src/lib/i18n/dictionaries";
import { translate } from "../src/lib/i18n";
import { checkoutSchema, passwordSchema, productSchema } from "../src/lib/schemas";

describe("money", () => {
  it("converts major units to satang without float drift", () => {
    expect(toMinor(1000)).toBe(100_000);
    expect(toMinor("250.55")).toBe(25_055);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("never returns NaN", () => {
    expect(safeMinor("abc", 42)).toBe(42);
    expect(fromMinor(12_345)).toBe(123.45);
  });

  it("formats THB for both locales", () => {
    expect(formatMoney(100_000, { locale: "th" })).toContain("1,000");
    expect(formatMoney(100_000, { locale: "en" })).toContain("฿");
  });

  it("computes basis points", () => {
    expect(percentOf(100_000, 1000)).toBe(10_000);
    expect(percentOf(100_000, 0)).toBe(0);
  });
});

describe("i18n", () => {
  it("has identical key sets for Thai and English", () => {
    const thKeys = Object.keys(th).sort();
    const enKeys = Object.keys(dictionaries.en).sort();
    expect(enKeys).toEqual(thKeys);
  });

  it("has no empty translations", () => {
    for (const [key, value] of Object.entries(dictionaries.en)) {
      expect(value.length, `empty EN translation for ${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(dictionaries.th)) {
      expect(value.length, `empty TH translation for ${key}`).toBeGreaterThan(0);
    }
  });

  it("interpolates parameters", () => {
    expect(translate("th", "shop.results", { count: 12 })).toContain("12");
    expect(translate("en", "product.lowStock", { count: 3 })).toContain("3");
  });

  it("falls back to Thai for unknown locales", () => {
    expect(translate("fr" as never, "nav.home")).toBe("หน้าแรก");
  });
});

describe("validation schemas", () => {
  const validCheckout = {
    contactName: "Somchai Jaidee",
    email: "SOMCHAI@Example.com",
    phone: "0812345678",
    recipientName: "Recipient",
    recipientPhone: "0898765432",
    addressLine: "88 Sukhumvit 31",
    subdistrict: "Khlong Tan Nuea",
    district: "Watthana",
    province: "Bangkok",
    postalCode: "10110",
    deliveryDate: "2026-12-01",
    slotStart: "09:00",
    slotEnd: "12:00",
    paymentMethod: "promptpay",
    acceptTerms: true,
    idempotencyKey: "abcdefgh-12345",
  };

  it("accepts a valid checkout and lowercases the email", () => {
    const parsed = checkoutSchema.safeParse(validCheckout);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("somchai@example.com");
  });

  it("rejects a bad postal code and phone", () => {
    const parsed = checkoutSchema.safeParse({ ...validCheckout, postalCode: "1011", phone: "123" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("postalCode");
      expect(paths).toContain("phone");
    }
  });

  it("requires accepting the terms", () => {
    const parsed = checkoutSchema.safeParse({ ...validCheckout, acceptTerms: false });
    expect(parsed.success).toBe(false);
  });

  it("enforces password strength", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("alllettersonly").success).toBe(false);
    expect(passwordSchema.safeParse("Strong1234").success).toBe(true);
  });

  it("rejects sale price above regular price", () => {
    const base = {
      sku: "SKU-1",
      slug: "test-product",
      categoryId: "cat_1",
      type: "bouquet",
      status: "draft",
      price: 100_000,
      salePrice: 120_000,
      stockQuantity: 1,
      nameTh: "ทดสอบ",
      nameEn: "Test",
    };
    const parsed = productSchema.safeParse(base);
    expect(parsed.success).toBe(false);
  });
});
