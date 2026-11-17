import { sql, type Kysely } from "kysely";
import type { Database } from "@/lib/db/schema";
import { db, nowIso, parseJson } from "@/lib/db";
import { getCurrentUser, readGuestToken } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { MAX_QTY_PER_LINE, cartCount, computeTotals, type CouponRules, type LineIssue, type Totals } from "@/lib/pricing";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";

export type CartAddon = { id: string; name: string; price: number };

export type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  addonsTotal: number;
  addons: CartAddon[];
  lineTotal: number;
  availableStock: number;
  maxQuantity: number;
  issues: LineIssue[];
  categoryId: string | null;
};

export type CartCouponState = {
  code: string;
  description: string | null;
  valid: boolean;
  error: string | null;
  discount: number;
};

export type CartView = {
  id: string | null;
  items: CartLine[];
  totals: Totals;
  coupon: CartCouponState | null;
  itemCount: number;
  hasBlockingIssues: boolean;
  currency: string;
  freeShippingRemaining: number;
};

const emptyTotals: Totals = {
  subtotal: 0,
  addonsTotal: 0,
  discountTotal: 0,
  shippingTotal: 0,
  taxTotal: 0,
  grandTotal: 0,
  freeShippingApplied: false,
  taxRateBp: 0,
};

export function emptyCart(): CartView {
  return {
    id: null,
    items: [],
    totals: emptyTotals,
    coupon: null,
    itemCount: 0,
    hasBlockingIssues: false,
    currency: "THB",
    freeShippingRemaining: 0,
  };
}

export async function findActiveCart(
  userId: string | null,
  guestToken: string | null,
): Promise<{ id: string; coupon_code: string | null } | null> {
  if (userId) {
    return (
      (await db
        .selectFrom("carts")
        .select(["id", "coupon_code"])
        .where("user_id", "=", userId)
        .where("status", "=", "active")
        .orderBy("updated_at", "desc")
        .executeTakeFirst()) ?? null
    );
  }
  if (guestToken) {
    return (
      (await db
        .selectFrom("carts")
        .select(["id", "coupon_code"])
        .where("guest_token", "=", guestToken)
        .where("status", "=", "active")
        .executeTakeFirst()) ?? null
    );
  }
  return null;
}

export async function getOrCreateCart(userId: string | null, guestToken: string | null, locale: Locale) {
  const existing = await findActiveCart(userId, guestToken);
  if (existing) return existing;

  const now = nowIso();
  const id = (
    await db
      .insertInto("carts")
      .values({
        id: `crt_${Date.now().toString(32)}${Math.random().toString(32).slice(2, 10)}`,
        user_id: userId,
        guest_token: userId ? null : guestToken,
        coupon_code: null,
        status: "active",
        locale,
        created_at: now,
        updated_at: now,
        expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        abandoned_notified_at: null,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  return { id, coupon_code: null };
}

export type CouponEvaluation = {
  ok: boolean;
  error: string | null;
  rules: CouponRules | null;
  code: string;
  description: string | null;
  discount: number;
};

export async function evaluateCoupon(
  rawCode: string,
  lines: Array<{ productId: string; categoryId: string | null; quantity: number; unitPrice: number; addonsTotal: number }>,
  context: { userId: string | null; email: string | null },
  executor: Kysely<Database> = db,
): Promise<CouponEvaluation> {
  const code = rawCode.trim().toUpperCase();
  const fail = (error: string): CouponEvaluation => ({
    ok: false,
    error,
    rules: null,
    code,
    description: null,
    discount: 0,
  });
  if (!code) return fail("error.couponInvalid");

  const coupon = await executor.selectFrom("coupons").selectAll().where("code", "=", code).executeTakeFirst();
  if (!coupon || coupon.status !== "active") return fail("error.couponInvalid");

  const now = nowIso();
  if (coupon.starts_at > now) return fail("error.couponInvalid");
  if (coupon.ends_at && coupon.ends_at < now) return fail("error.couponInvalid");

  const merchandise = lines.reduce((sum, l) => sum + (l.unitPrice + l.addonsTotal) * l.quantity, 0);
  if (merchandise < coupon.min_spend) return fail("error.couponInvalid");

  if (coupon.usage_limit !== null) {
    const used = await executor
      .selectFrom("coupon_usages")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("coupon_id", "=", coupon.id)
      .executeTakeFirst();
    if (Number(used?.count ?? 0) >= coupon.usage_limit) return fail("error.couponLimit");
  }

  if (coupon.per_customer_limit > 0) {
    const byUser = context.userId
      ? Number(
          (
            await executor
              .selectFrom("coupon_usages")
              .select(({ fn }) => fn.countAll<string>().as("count"))
              .where("coupon_id", "=", coupon.id)
              .where("user_id", "=", context.userId)
              .executeTakeFirst()
          )?.count ?? 0,
        )
      : 0;
    const byEmail = context.email
      ? Number(
          (
            await executor
              .selectFrom("coupon_usages")
              .select(({ fn }) => fn.countAll<string>().as("count"))
              .where("coupon_id", "=", coupon.id)
              .where(sql`lower(email)`, "=", context.email.toLowerCase())
              .executeTakeFirst()
          )?.count ?? 0,
        )
      : 0;
    if (Math.max(byUser, byEmail) >= coupon.per_customer_limit) return fail("error.couponLimit");
  }

  const rules: CouponRules = {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minSpend: coupon.min_spend,
    maxDiscount: coupon.max_discount,
    freeShipping: coupon.free_shipping === 1,
    appliesTo: coupon.applies_to,
    productIds: parseJson<string[]>(coupon.product_ids, []),
    categoryIds: parseJson<string[]>(coupon.category_ids, []),
  };

  const settings = await getSettings();
  const totals = computeTotals(
    lines,
    rules,
    {
      fee: settings.shipping.fee,
      freeThreshold: settings.shipping.freeThreshold,
      taxRateBp: settings.commerce.taxRateBp,
      pricesIncludeTax: settings.commerce.pricesIncludeTax,
    },
  );

  if (discountIsZero(rules, totals.discountTotal)) {
    return fail("error.couponInvalid");
  }

  return {
    ok: true,
    error: null,
    rules,
    code: coupon.code,
    description: null,
    discount: totals.discountTotal,
  };
}

function discountIsZero(rules: CouponRules, discount: number): boolean {
  if (rules.type === "free_shipping" || rules.freeShipping) return false;
  return discount <= 0;
}

type RawLine = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  addonIds: string[];
  snapshot: number;
  slug: string | null;
  name: string | null;
  categoryId: string | null;
  price: number | null;
  salePrice: number | null;
  stock: number | null;
  status: string | null;
  deletedAt: string | null;
  imageUrl: string | null;
  variantName: string | null;
  variantDelta: number | null;
  variantStock: number | null;
  variantStatus: string | null;
};

async function loadRawLines(cartId: string, locale: Locale): Promise<RawLine[]> {
  const rows = await db
    .selectFrom("cart_items as ci")
    .leftJoin("products as p", "p.id", "ci.product_id")
    .leftJoin("product_translations as pt", (join) =>
      join.onRef("pt.product_id", "=", "ci.product_id").on("pt.locale", "=", locale),
    )
    .leftJoin("product_translations as pt2", (join) =>
      join.onRef("pt2.product_id", "=", "ci.product_id").on("pt2.locale", "=", "th"),
    )
    .leftJoin("product_variants as v", "v.id", "ci.variant_id")
    .select([
      "ci.id",
      "ci.product_id as productId",
      "ci.variant_id as variantId",
      "ci.quantity",
      "ci.addon_ids as addonIds",
      "ci.unit_price_snapshot as snapshot",
      "p.slug",
      sql<string | null>`coalesce(pt.name, pt2.name)`.as("name"),
      "p.category_id as categoryId",
      "p.price",
      "p.sale_price as salePrice",
      "p.stock_quantity as stock",
      "p.status",
      "p.deleted_at as deletedAt",
      sql<string | null>`(select url from product_images where product_id = p.id order by sort_order asc limit 1)`.as(
        "imageUrl",
      ),
      sql<string | null>`case when v.id is null then null when ${locale} = 'en' then v.name_en else v.name_th end`.as(
        "variantName",
      ),
      "v.price_delta as variantDelta",
      "v.stock_quantity as variantStock",
      "v.status as variantStatus",
    ])
    .where("ci.cart_id", "=", cartId)
    .orderBy("ci.created_at", "asc")
    .execute();
  return (rows as unknown as RawLine[]).map((row) => ({
    ...row,
    addonIds: parseJson<string[]>(row.addonIds as unknown as string, []),
  }));
}

export async function buildCartView(
  cartRow: { id: string; coupon_code: string | null } | null,
  locale: Locale,
  email: string | null = null,
): Promise<CartView> {
  if (!cartRow) return emptyCart();
  const settings = await getSettings();
  const shippingRules = {
    fee: settings.shipping.fee,
    freeThreshold: settings.shipping.freeThreshold,
    taxRateBp: settings.commerce.taxRateBp,
    pricesIncludeTax: settings.commerce.pricesIncludeTax,
  };

  const raw = await loadRawLines(cartRow.id, locale);
  const addonRows = raw.length
    ? await db
        .selectFrom("addons")
        .selectAll()
        .where(
          "id",
          "in",
          [...new Set(raw.flatMap((line) => line.addonIds))].filter(Boolean),
        )
        .execute()
    : [];
  const addonMap = new Map(addonRows.map((addon) => [addon.id, addon]));

  const items: CartLine[] = [];
  for (const line of raw) {
    if (!line.slug || !line.name || line.price === null || line.deletedAt !== null) continue;

    const issues: LineIssue[] = [];
    if (line.status !== "published") {
      issues.push({ code: "unavailable", message: translate(locale, "cart.unavailable"), severity: "error" });
    }
    if (line.variantId && (line.variantStatus !== "active" || line.variantDelta === null)) {
      issues.push({
        code: "variant_unavailable",
        message: translate(locale, "cart.unavailable"),
        severity: "error",
      });
    }

    const addons: CartAddon[] = [];
    let addonsTotal = 0;
    for (const addonId of line.addonIds) {
      const addon = addonMap.get(addonId);
      if (!addon || addon.status !== "active") {
        issues.push({
          code: "addon_unavailable",
          message: translate(locale, "cart.unavailable"),
          severity: "warning",
        });
        continue;
      }
      addons.push({ id: addon.id, name: locale === "th" ? addon.name_th : addon.name_en, price: addon.price });
      addonsTotal += addon.price;
    }

    const unitPrice = (line.salePrice !== null && line.salePrice < line.price ? line.salePrice : line.price) + (line.variantDelta ?? 0);
    const availableStock = line.variantId ? (line.variantStock ?? 0) : (line.stock ?? 0);
    if (availableStock <= 0) {
      issues.push({ code: "out_of_stock", message: translate(locale, "product.outOfStock"), severity: "error" });
    } else if (line.quantity > availableStock) {
      issues.push({
        code: "insufficient_stock",
        message: translate(locale, "cart.outOfStockWarning"),
        severity: "error",
      });
    }
    if (line.quantity > MAX_QTY_PER_LINE) {
      issues.push({ code: "max_quantity", message: translate(locale, "validation.max", { max: MAX_QTY_PER_LINE }), severity: "warning" });
    }
    if (line.snapshot > 0 && line.snapshot !== unitPrice + addonsTotal) {
      issues.push({ code: "price_changed", message: translate(locale, "cart.priceChanged"), severity: "warning" });
    }

    items.push({
      id: line.id,
      productId: line.productId,
      variantId: line.variantId,
      slug: line.slug,
      name: line.name,
      variantName: line.variantName,
      imageUrl: line.imageUrl,
      quantity: line.quantity,
      unitPrice,
      addonsTotal,
      addons,
      lineTotal: (unitPrice + addonsTotal) * line.quantity,
      availableStock,
      maxQuantity: Math.min(MAX_QTY_PER_LINE, Math.max(0, availableStock)),
      issues,
      categoryId: line.categoryId,
    });
  }

  const pricingLines = items.map((item) => ({
    productId: item.productId,
    categoryId: item.categoryId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    addonsTotal: item.addonsTotal,
  }));

  let coupon: CartCouponState | null = null;
  let rules: CouponRules | null = null;
  if (cartRow.coupon_code) {
    const evaluation = await evaluateCoupon(cartRow.coupon_code, pricingLines, { userId: null, email });
    const couponRow = evaluation.ok
      ? await db.selectFrom("coupons").select(["description_th", "description_en"]).where("code", "=", cartRow.coupon_code).executeTakeFirst()
      : null;
    coupon = {
      code: cartRow.coupon_code,
      description: couponRow ? (locale === "th" ? couponRow.description_th : couponRow.description_en) : null,
      valid: evaluation.ok,
      error: evaluation.error,
      discount: evaluation.discount,
    };
    if (evaluation.ok) rules = evaluation.rules;
  }

  const totals = computeTotals(pricingLines, rules, shippingRules);
  const merchandise = totals.subtotal + totals.addonsTotal;

  return {
    id: cartRow.id,
    items,
    totals,
    coupon,
    itemCount: cartCount(items),
    hasBlockingIssues: items.some((item) => item.issues.some((issue) => issue.severity === "error")),
    currency: settings.commerce.currency,
    freeShippingRemaining:
      settings.shipping.freeThreshold > merchandise ? settings.shipping.freeThreshold - merchandise : 0,
  };
}

export async function getCart(locale: Locale): Promise<CartView> {
  const user = await getCurrentUser();
  const guestToken = user ? null : await readGuestToken();
  if (!user && !guestToken) return emptyCart();
  const cartRow = await findActiveCart(user?.id ?? null, guestToken);
  if (!cartRow) return emptyCart();
  return buildCartView(cartRow, locale, user?.email ?? null);
}

export async function touchCart(cartId: string): Promise<void> {
  await db.updateTable("carts").set({ updated_at: nowIso() }).where("id", "=", cartId).execute();
}

/** Adds an item (or increments an identical line). Returns the cart id used. */
export async function addLine(params: {
  cartId: string;
  productId: string;
  variantId: string | null;
  addonIds: string[];
  quantity: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const product = await db
    .selectFrom("products")
    .select(["id", "status", "stock_quantity", "price", "sale_price", "deleted_at"])
    .where("id", "=", params.productId)
    .executeTakeFirst();
  if (!product || product.deleted_at || product.status !== "published") {
    return { ok: false, error: "error.stock" };
  }

  let stock = product.stock_quantity;
  let variantDelta = 0;
  if (params.variantId) {
    const variant = await db
      .selectFrom("product_variants")
      .select(["id", "stock_quantity", "status", "price_delta"])
      .where("id", "=", params.variantId)
      .where("product_id", "=", product.id)
      .executeTakeFirst();
    if (!variant || variant.status !== "active") return { ok: false, error: "error.stock" };
    stock = variant.stock_quantity;
    variantDelta = variant.price_delta;
  }

  const addonRows = params.addonIds.length
    ? await db
        .selectFrom("addons")
        .select(["id", "price", "status"])
        .where("id", "in", params.addonIds)
        .execute()
    : [];
  if (addonRows.some((addon) => addon.status !== "active")) return { ok: false, error: "error.stock" };
  const addonsTotal = addonRows.reduce((sum, addon) => sum + addon.price, 0);

  const addonSignature = [...params.addonIds].sort().join("|");
  const existing = await db
    .selectFrom("cart_items")
    .select(["id", "quantity"])
    .where("cart_id", "=", params.cartId)
    .where("product_id", "=", params.productId)
    .where("variant_id", "is", params.variantId)
    .where("addon_signature", "=", addonSignature)
    .executeTakeFirst();

  const desired = Math.min(MAX_QTY_PER_LINE, Math.max(1, (existing?.quantity ?? 0) + params.quantity));
  if (desired > stock) return { ok: false, error: "error.stock" };

  const unit = (product.sale_price !== null && product.sale_price < product.price ? product.sale_price : product.price) + variantDelta;
  const now = nowIso();

  if (existing) {
    await db
      .updateTable("cart_items")
      .set({ quantity: desired, updated_at: now, unit_price_snapshot: unit + addonsTotal })
      .where("id", "=", existing.id)
      .execute();
  } else {
    await db
      .insertInto("cart_items")
      .values({
        id: `cit_${Date.now().toString(32)}${Math.random().toString(32).slice(2, 8)}`,
        cart_id: params.cartId,
        product_id: params.productId,
        variant_id: params.variantId,
        addon_ids: JSON.stringify([...params.addonIds].sort()),
        addon_signature: addonSignature,
        unit_price_snapshot: unit + addonsTotal,
        quantity: desired,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
  await touchCart(params.cartId);
  return { ok: true };
}

export async function updateLineQuantity(
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<{ ok: boolean; error?: string }> {
  const item = await db
    .selectFrom("cart_items")
    .selectAll()
    .where("id", "=", itemId)
    .where("cart_id", "=", cartId)
    .executeTakeFirst();
  if (!item) return { ok: false, error: "common.notFound" };

  if (quantity <= 0) {
    await db.deleteFrom("cart_items").where("id", "=", itemId).execute();
    await touchCart(cartId);
    return { ok: true };
  }

  const product = await db
    .selectFrom("products")
    .select(["stock_quantity"])
    .where("id", "=", item.product_id)
    .executeTakeFirst();
  let stock = product?.stock_quantity ?? 0;
  if (item.variant_id) {
    const variant = await db
      .selectFrom("product_variants")
      .select(["stock_quantity"])
      .where("id", "=", item.variant_id)
      .executeTakeFirst();
    stock = variant?.stock_quantity ?? 0;
  }
  const desired = Math.min(quantity, MAX_QTY_PER_LINE, Math.max(1, stock));
  if (desired < 1) return { ok: false, error: "error.stock" };

  await db
    .updateTable("cart_items")
    .set({ quantity: desired, updated_at: nowIso() })
    .where("id", "=", itemId)
    .execute();
  await touchCart(cartId);
  return { ok: true };
}

export async function removeLine(cartId: string, itemId: string): Promise<void> {
  await db.deleteFrom("cart_items").where("id", "=", itemId).where("cart_id", "=", cartId).execute();
  await touchCart(cartId);
}

export async function setCartCoupon(cartId: string, code: string | null): Promise<void> {
  await db
    .updateTable("carts")
    .set({ coupon_code: code, updated_at: nowIso() })
    .where("id", "=", cartId)
    .execute();
}

export async function clearCart(cartId: string): Promise<void> {
  await db.deleteFrom("cart_items").where("cart_id", "=", cartId).execute();
  await db
    .updateTable("carts")
    .set({ status: "converted", coupon_code: null, updated_at: nowIso() })
    .where("id", "=", cartId)
    .execute();
}

/** Merges the guest cart into the member cart after sign-in. */
export async function mergeGuestCart(userId: string, guestToken: string | null, locale: Locale): Promise<void> {
  if (!guestToken) return;
  const guestCart = await db
    .selectFrom("carts")
    .select("id")
    .where("guest_token", "=", guestToken)
    .where("status", "=", "active")
    .executeTakeFirst();
  if (!guestCart) return;

  const memberCart = await getOrCreateCart(userId, null, locale);
  if (memberCart.id === guestCart.id) return;

  const guestItems = await db.selectFrom("cart_items").selectAll().where("cart_id", "=", guestCart.id).execute();
  for (const item of guestItems) {
    const existing = await db
      .selectFrom("cart_items")
      .select(["id", "quantity"])
      .where("cart_id", "=", memberCart.id)
      .where("product_id", "=", item.product_id)
      .where("variant_id", "is", item.variant_id)
      .where("addon_signature", "=", item.addon_signature)
      .executeTakeFirst();
    if (existing) {
      await db
        .updateTable("cart_items")
        .set({ quantity: Math.min(MAX_QTY_PER_LINE, existing.quantity + item.quantity), updated_at: nowIso() })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db
        .updateTable("cart_items")
        .set({ cart_id: memberCart.id, updated_at: nowIso() })
        .where("id", "=", item.id)
        .execute();
    }
  }

  // Carry the coupon over only when the member cart has none.
  const guest = await db.selectFrom("carts").select("coupon_code").where("id", "=", guestCart.id).executeTakeFirst();
  if (guest?.coupon_code && !memberCart.coupon_code) {
    await setCartCoupon(memberCart.id, guest.coupon_code);
  }
  await db.updateTable("carts").set({ status: "converted", updated_at: nowIso() }).where("id", "=", guestCart.id).execute();
}

export async function getCartBadgeCount(): Promise<number> {
  const user = await getCurrentUser();
  const guestToken = user ? null : await readGuestToken();
  if (!user && !guestToken) return 0;
  const cart = await findActiveCart(user?.id ?? null, guestToken);
  if (!cart) return 0;
  const row = await db
    .selectFrom("cart_items")
    .select((eb) => eb.fn.sum<number>("quantity").as("total"))
    .where("cart_id", "=", cart.id)
    .executeTakeFirst();
  return Number(row?.total ?? 0);
}

export async function getWishlistIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await db
    .selectFrom("wishlist_items as wi")
    .innerJoin("wishlists as w", "w.id", "wi.wishlist_id")
    .select("wi.product_id")
    .where("w.user_id", "=", userId)
    .execute();
  return rows.map((row) => row.product_id);
}

export async function toggleWishlist(
  userId: string,
  productId: string,
): Promise<{ added: boolean }> {
  let wishlist = await db.selectFrom("wishlists").select("id").where("user_id", "=", userId).executeTakeFirst();
  if (!wishlist) {
    const id = `wsh_${Date.now().toString(32)}${Math.random().toString(32).slice(2, 8)}`;
    await db.insertInto("wishlists").values({ id, user_id: userId, created_at: nowIso() }).execute();
    wishlist = { id };
  }
  const existing = await db
    .selectFrom("wishlist_items")
    .select("id")
    .where("wishlist_id", "=", wishlist.id)
    .where("product_id", "=", productId)
    .executeTakeFirst();
  if (existing) {
    await db.deleteFrom("wishlist_items").where("id", "=", existing.id).execute();
    return { added: false };
  }
  await db
    .insertInto("wishlist_items")
    .values({
      id: `wit_${Date.now().toString(32)}${Math.random().toString(32).slice(2, 8)}`,
      wishlist_id: wishlist.id,
      product_id: productId,
      created_at: nowIso(),
    })
    .execute();
  return { added: true };
}

export async function recentlyViewedIds(userId: string | null, guestToken: string | null, limit = 6): Promise<string[]> {
  if (!userId && !guestToken) return [];
  let query = db.selectFrom("recently_viewed").select("product_id").orderBy("viewed_at", "desc").limit(limit);
  if (userId) query = query.where("user_id", "=", userId);
  else query = query.where("guest_token", "=", guestToken);
  const rows = await query.execute();
  return [...new Set(rows.map((row) => row.product_id))];
}

export async function recordRecentlyViewed(
  userId: string | null,
  guestToken: string | null,
  productId: string,
): Promise<void> {
  if (!userId && !guestToken) return;
  await db
    .deleteFrom("recently_viewed")
    .where("product_id", "=", productId)
    .where("user_id", "is", userId)
    .where("guest_token", "is", guestToken)
    .execute();
  await db
    .insertInto("recently_viewed")
    .values({
      id: `rvw_${Date.now().toString(32)}${Math.random().toString(32).slice(2, 8)}`,
      user_id: userId,
      guest_token: userId ? null : guestToken,
      product_id: productId,
      viewed_at: nowIso(),
    })
    .execute();
}
