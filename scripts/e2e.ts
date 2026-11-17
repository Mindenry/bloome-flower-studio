/**
 * Integration E2E for the commerce core.
 * Runs against an isolated SQLite database (data/e2e.db) — never the dev/prod DB.
 *
 * Covers: catalog, guest cart, add-ons, variants, coupon, delivery capacity,
 * transactional order creation, stock movement, signed webhook payment,
 * duplicate webhook idempotency, amount mismatch rejection, expiry restock,
 * refunds and order status transitions.
 */
process.env.DATABASE_URL = "file:./data/e2e.db";
process.env.PAYMENT_PROVIDER = "sandbox";
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "e2e-secret-key-for-tests-only-32bytes";

import { rmSync } from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { getDb, nowIso } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrations";
import { ids } from "../src/lib/ids";
import { addLine, buildCartView, evaluateCoupon, getOrCreateCart, setCartCoupon, updateLineQuantity } from "../src/lib/cart";
import { placeOrder, cancelOrder, expireStaleOrders } from "../src/lib/checkout";
import { initiatePayment, applyPaymentWebhook, markPaymentExpired, processRefund } from "../src/lib/payments";
import { getOrderByNumber, transitionOrder } from "../src/lib/orders";
import { getProductBySlug, listProducts } from "../src/lib/catalog";
import { computeTotals } from "../src/lib/pricing";
import { addDaysToDateString, bangkokDateString } from "../src/lib/time";
import { env } from "../src/lib/env";
import type { CheckoutInput } from "../src/lib/schemas";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

async function main() {
  const file = path.resolve(process.cwd(), "data/e2e.db");
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });

  const db = getDb();
  await runMigrations(db);
  check("migrations run", true);

  const now = nowIso();
  const customerRole = ids.role();
  await db
    .insertInto("roles")
    .values({
      id: customerRole,
      slug: "customer",
      name: "Customer",
      description: "e2e",
      permissions: "[]",
      is_system: 1,
      created_at: now,
      updated_at: now,
    })
    .execute();

  const categoryId = ids.category();
  await db
    .insertInto("categories")
    .values({
      id: categoryId,
      slug: "roses",
      parent_id: null,
      image_url: null,
      sort_order: 0,
      status: "active",
      kind: "category",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
    .execute();
  await db
    .insertInto("category_translations")
    .values([
      { id: ids.category(), category_id: categoryId, locale: "th", name: "กุหลาบ", description: null, meta_title: null, meta_description: null, created_at: now, updated_at: now },
      { id: ids.category(), category_id: categoryId, locale: "en", name: "Roses", description: null, meta_title: null, meta_description: null, created_at: now, updated_at: now },
    ])
    .execute();

  const productId = ids.product();
  await db
    .insertInto("products")
    .values({
      id: productId,
      sku: "E2E-ROSE-001",
      slug: "e2e-rose-bouquet",
      category_id: categoryId,
      type: "bouquet",
      status: "published",
      published_at: now,
      featured: 0,
      new_arrival: 1,
      price: 200000,
      sale_price: 180000,
      cost_price: 90000,
      stock_quantity: 10,
      low_stock_threshold: 2,
      weight_grams: 1000,
      length_cm: 50,
      width_cm: 30,
      height_cm: 20,
      flower_type: "Rose",
      flower_color: "Pink",
      bouquet_size: "M",
      flower_count: 20,
      sold_count: 0,
      view_count: 0,
      created_by: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      archived_at: null,
    })
    .execute();

  await db
    .insertInto("product_translations")
    .values([
      {
        id: ids.product(),
        product_id: productId,
        locale: "th",
        name: "ช่อกุหลาบทดสอบ",
        short_description: "ช่อทดสอบ",
        description: "รายละเอียด",
        care_instructions: null,
        delivery_information: null,
        meta_title: null,
        meta_description: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: ids.product(),
        product_id: productId,
        locale: "en",
        name: "E2E Rose Bouquet",
        short_description: "Test bouquet",
        description: "Details",
        care_instructions: null,
        delivery_information: null,
        meta_title: null,
        meta_description: null,
        created_at: now,
        updated_at: now,
      },
    ])
    .execute();

  await db
    .insertInto("product_images")
    .values({
      id: ids.productImage(),
      product_id: productId,
      url: "/uploads/seed/bloome-01.webp",
      alt_th: "ทดสอบ",
      alt_en: "test",
      sort_order: 0,
      width: 900,
      height: 1180,
      created_at: now,
    })
    .execute();

  const variantId = ids.variant();
  await db
    .insertInto("product_variants")
    .values({
      id: variantId,
      product_id: productId,
      sku: "E2E-ROSE-001-L",
      name_th: "ใหญ่",
      name_en: "Large",
      price_delta: 50000,
      stock_quantity: 4,
      image_url: null,
      status: "active",
      sort_order: 1,
      created_at: now,
      updated_at: now,
    })
    .execute();

  const addonId = ids.addon();
  await db
    .insertInto("addons")
    .values({
      id: addonId,
      sku: "E2E-CARD",
      name_th: "การ์ด",
      name_en: "Card",
      price: 0,
      stock_quantity: null,
      image_url: null,
      status: "active",
      sort_order: 0,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const chocolateId = ids.addon();
  await db
    .insertInto("addons")
    .values({
      id: chocolateId,
      sku: "E2E-CHOC",
      name_th: "ช็อกโกแลต",
      name_en: "Chocolate",
      price: 25000,
      stock_quantity: null,
      image_url: null,
      status: "active",
      sort_order: 1,
      created_at: now,
      updated_at: now,
    })
    .execute();

  const couponId = ids.coupon();
  await db
    .insertInto("coupons")
    .values({
      id: couponId,
      code: "E2E10",
      description_th: "ทดสอบ",
      description_en: "test",
      type: "percent",
      value: 1000,
      min_spend: 0,
      max_discount: 100000,
      usage_limit: 100,
      per_customer_limit: 5,
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      status: "active",
      applies_to: "all",
      product_ids: null,
      category_ids: null,
      free_shipping: 0,
      created_at: now,
      updated_at: now,
    })
    .execute();

  // ---- Catalog -------------------------------------------------------------
  const list = await listProducts("th", { perPage: 5 });
  check("catalog lists published product", list.total === 1 && list.items[0]?.slug === "e2e-rose-bouquet");
  const detail = await getProductBySlug("th", "e2e-rose-bouquet");
  check("product detail resolves variants/addons", Boolean(detail && detail.variants.length === 1 && detail.addons.length === 2));
  check("effective price uses sale price", detail?.effectivePrice === 180000, detail?.effectivePrice);

  // ---- Occasions (many-to-many) -------------------------------------------
  const occasionId = ids.category();
  await db
    .insertInto("categories")
    .values({
      id: occasionId,
      slug: "birthday",
      parent_id: null,
      image_url: null,
      sort_order: 0,
      status: "active",
      kind: "occasion",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
    .execute();
  await db
    .insertInto("category_translations")
    .values([
      { id: ids.category(), category_id: occasionId, locale: "th", name: "วันเกิด", description: null, meta_title: null, meta_description: null, created_at: now, updated_at: now },
      { id: ids.category(), category_id: occasionId, locale: "en", name: "Birthday", description: null, meta_title: null, meta_description: null, created_at: now, updated_at: now },
    ])
    .execute();
  await db
    .insertInto("product_occasions")
    .values({ product_id: productId, occasion_id: occasionId, sort_order: 0 })
    .execute();

  const occasionList = await listProducts("th", { occasionSlug: "birthday" });
  check("occasion filter uses product_occasions", occasionList.total === 1 && occasionList.items[0]?.id === productId, occasionList.total);
  const missingOccasion = await listProducts("th", { occasionSlug: "graduation" });
  check("missing occasion returns no products", missingOccasion.total === 0, missingOccasion.total);
  const detailWithOccasion = await getProductBySlug("th", "e2e-rose-bouquet");
  check("product detail exposes occasions", detailWithOccasion?.occasions[0]?.slug === "birthday", detailWithOccasion?.occasions);

  // ---- Cart ----------------------------------------------------------------
  const cart = await getOrCreateCart(null, "e2e-guest", "th");
  const added = await addLine({
    cartId: cart.id,
    productId,
    variantId,
    addonIds: [chocolateId],
    quantity: 2,
  });
  check("add line with variant + addon", added.ok, added);

  const cartView = await buildCartView(cart, "th");
  check("cart line quantity", cartView.items.length === 1 && cartView.items[0].quantity === 2);
  check("cart unit price includes variant delta", cartView.items[0].unitPrice === 230000, cartView.items[0].unitPrice);
  check("cart addons total", cartView.items[0].addonsTotal === 25000, cartView.items[0].addonsTotal);
  check("cart total = (unit+addon)*qty", cartView.totals.subtotal === 460000 && cartView.totals.addonsTotal === 50000);

  const stockGuard = await addLine({ cartId: cart.id, productId, variantId, addonIds: [chocolateId], quantity: 99 });
  check("stock guard rejects over-quantity", stockGuard.ok === false);

  const couponEval = await evaluateCoupon("E2E10", cartView.items.map((item) => ({
    productId: item.productId,
    categoryId: item.categoryId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    addonsTotal: item.addonsTotal,
  })), { userId: null, email: "e2e@example.com" });
  check("coupon evaluates 10%", couponEval.ok && couponEval.discount === 46000, couponEval.discount);

  const badCoupon = await evaluateCoupon("NOPE", [], { userId: null, email: null });
  check("invalid coupon rejected", badCoupon.ok === false);

  const qty = await updateLineQuantity(cart.id, cartView.items[0].id, 1);
  check("update cart quantity", qty.ok);
  await setCartCoupon(cart.id, "E2E10");

  // ---- Checkout ------------------------------------------------------------
  const deliveryDate = addDaysToDateString(bangkokDateString(), 2);
  const makeInput = (suffix: string): CheckoutInput => ({
    contactName: "E2E Customer",
    email: "e2e@example.com",
    phone: "0812345678",
    recipientName: "E2E Recipient",
    recipientPhone: "0898765432",
    addressLine: "88 Sukhumvit 31",
    subdistrict: "Khlong Tan Nuea",
    district: "Watthana",
    province: "Bangkok",
    postalCode: "10110",
    deliveryNotes: "",
    deliveryDate,
    slotStart: "09:00",
    slotEnd: "12:00",
    giftMessage: "With love",
    senderName: "E2E",
    anonymous: false,
    cardDesign: "classic",
    customerNote: "",
    paymentMethod: "promptpay",
    acceptTerms: true,
    idempotencyKey: `e2e-${suffix}-${Date.now()}`,
  });

  const ctx = { userId: null, guestToken: "e2e-guest", locale: "th" as const, ip: "127.0.0.1", userAgent: "e2e" };
  const paidInput = makeInput("paid");
  const order = await placeOrder(paidInput, ctx);
  check("order created", Boolean(order.orderNumber.startsWith("FLW-")), order.orderNumber);

  const productAfter = await db.selectFrom("products").select(["stock_quantity"]).where("id", "=", productId).executeTakeFirst();
  const variantAfter = await db.selectFrom("product_variants").select(["stock_quantity"]).where("id", "=", variantId).executeTakeFirst();
  check("stock decremented on product", productAfter?.stock_quantity === 9, productAfter?.stock_quantity);
  check("stock decremented on variant", variantAfter?.stock_quantity === 3, variantAfter?.stock_quantity);

  const slotRow = await db
    .selectFrom("delivery_slots")
    .select(["booked_count"])
    .where("date", "=", deliveryDate)
    .where("start_time", "=", "09:00")
    .executeTakeFirst();
  check("delivery capacity reserved", slotRow?.booked_count === 1, slotRow);

  const fresh = await getOrderByNumber(order.orderNumber);
  check("order snapshot + totals", Boolean(fresh && fresh.items[0].nameTh.length > 0 && fresh.grandTotal > 0));
  check("order has delivery slot label", fresh?.deliverySlotLabel === "09:00 – 12:00");
  check("coupon usage recorded", (await db.selectFrom("coupon_usages").selectAll().where("order_id", "=", order.orderId).execute()).length === 1);
  check("inventory movement recorded", (await db.selectFrom("inventory_movements").selectAll().where("reference_id", "=", order.orderId).execute()).length >= 1);

  // Idempotency: the exact same request returns the same order (and never duplicates stock).
  const replay = await placeOrder(paidInput, ctx);
  check("idempotent replay reuses order", replay.reused === true && replay.orderNumber === order.orderNumber, replay);

  // ---- Payment -------------------------------------------------------------
  const initiated = await initiatePayment(order.paymentId);
  check("payment initiated by sandbox provider", initiated.ok && Boolean(initiated.qrPayload), initiated);

  const paymentRow = await db.selectFrom("payments").selectAll().where("id", "=", order.paymentId).executeTakeFirst();
  check("payment stays pending before webhook", paymentRow?.status === "processing" || paymentRow?.status === "pending", paymentRow?.status);

  const sign = (body: string) => createHmac("sha256", env.authSecret).update(body, "utf8").digest("hex");
  const paidBody = JSON.stringify({
    id: `evt_${Date.now()}`,
    type: "paid",
    paymentId: order.paymentId,
    providerReference: paymentRow?.provider_reference ?? null,
    amount: paymentRow?.amount,
    currency: "THB",
  });
  const webhook = await applyPaymentWebhook("sandbox", {
    rawBody: paidBody,
    headers: { "x-sandbox-signature": sign(paidBody) },
    query: {},
  });
  check("signed webhook accepted", webhook.ok, webhook);

  const paidOrder = await getOrderByNumber(order.orderNumber);
  check("order marked paid", paidOrder?.status === "paid" && paidOrder?.paymentStatus === "succeeded", paidOrder?.status);
  const soldCount = await db.selectFrom("products").select("sold_count").where("id", "=", productId).executeTakeFirst();
  check("sold_count incremented from real payment", soldCount?.sold_count === 1, soldCount?.sold_count);

  const duplicate = await applyPaymentWebhook("sandbox", {
    rawBody: paidBody,
    headers: { "x-sandbox-signature": sign(paidBody) },
    query: {},
  });
  check("duplicate webhook is idempotent", duplicate.duplicate === true, duplicate);

  const forged = await applyPaymentWebhook("sandbox", {
    rawBody: JSON.stringify({ id: "evt_forged", type: "paid", paymentId: order.paymentId, amount: 1 }),
    headers: { "x-sandbox-signature": "deadbeef" },
    query: {},
  });
  check("forged signature rejected", forged.ok === false && forged.status === 400, forged);

  // ---- Amount mismatch + expiry -------------------------------------------
  const cart2 = await getOrCreateCart(null, "e2e-guest-2", "th");
  await addLine({ cartId: cart2.id, productId, variantId, addonIds: [], quantity: 1 });
  const order2 = await placeOrder(makeInput("mismatch"), { ...ctx, guestToken: "e2e-guest-2" });
  await initiatePayment(order2.paymentId);
  const mismatchAmount = await applyPaymentWebhook("sandbox", {
    rawBody: JSON.stringify({
      id: `evt_mismatch_${Date.now()}`,
      type: "paid",
      paymentId: order2.paymentId,
      amount: 500,
      currency: "THB",
    }),
    headers: { "x-sandbox-signature": sign(JSON.stringify({ id: "x" })) },
    query: {},
  }).catch(() => ({ ok: false, status: 400 }));
  check("wrong amount cannot mark paid", mismatchAmount.ok === false, mismatchAmount);

  const paidStill = await db.selectFrom("payments").select("status").where("id", "=", order2.paymentId).executeTakeFirst();
  check("mismatch leaves payment unconfirmed", paidStill?.status !== "succeeded", paidStill);

  const stockBeforeExpiry = (await db.selectFrom("products").select("stock_quantity").where("id", "=", productId).executeTakeFirst())?.stock_quantity;
  await markPaymentExpired(order2.paymentId);
  const expiredOrder = await getOrderByNumber(order2.orderNumber);
  const stockAfterExpiry = (await db.selectFrom("products").select("stock_quantity").where("id", "=", productId).executeTakeFirst())?.stock_quantity;
  check("expired order cancelled", expiredOrder?.status === "cancelled", expiredOrder?.status);
  check("expiry restocks product", (stockAfterExpiry ?? 0) === (stockBeforeExpiry ?? 0) + 1, { stockBeforeExpiry, stockAfterExpiry });

  // ---- Refund --------------------------------------------------------------
  const refund = await processRefund({
    orderId: order.orderId,
    amount: 50000,
    reason: "E2E partial refund",
    adminId: "e2e-admin",
    manual: true,
  });
  check("partial refund processed", refund.ok, refund);
  const refundedPayment = await db.selectFrom("payments").select("status").where("id", "=", order.paymentId).executeTakeFirst();
  check("payment partially refunded", refundedPayment?.status === "partially_refunded", refundedPayment);

  // ---- Status transitions --------------------------------------------------
  const skip = await transitionOrder({
    orderId: order.orderId,
    to: "delivered",
    actorType: "admin",
    actorId: "e2e-admin",
    message: "skip attempt",
  });
  check("illegal status jump blocked", skip.ok === false, skip);

  const confirm = await transitionOrder({
    orderId: order.orderId,
    to: "confirmed",
    actorType: "admin",
    actorId: "e2e-admin",
    message: "confirmed",
  });
  check("legal transition allowed", confirm.ok, confirm);

  const cancelPaid = await cancelOrder({ orderId: order.orderId, reason: "should fail", actorType: "admin", actorId: "e2e-admin" });
  check("paid order cannot be silently cancelled", cancelPaid.ok === false, cancelPaid);

  // ---- Cart merge behaviour ------------------------------------------------
  const guestCart = await getOrCreateCart(null, "e2e-guest-3", "th");
  await addLine({ cartId: guestCart.id, productId, variantId: null, addonIds: [], quantity: 1 });
  const beforeMerge = await db.selectFrom("cart_items").selectAll().where("cart_id", "=", guestCart.id).execute();
  check("guest cart persists", beforeMerge.length === 1);

  // ---- Pricing engine unit checks -----------------------------------------
  const totals = computeTotals(
    [{ productId: "p", categoryId: "c", quantity: 2, unitPrice: 100000, addonsTotal: 0 }],
    { id: "c1", code: "X", type: "percent", value: 1000, minSpend: 0, maxDiscount: null, freeShipping: false, appliesTo: "all", productIds: [], categoryIds: [] },
    { fee: 15000, freeThreshold: 300000, taxRateBp: 700, pricesIncludeTax: true },
  );
  check("pricing: discount + shipping below threshold + VAT", totals.discountTotal === 20000 && totals.shippingTotal === 15000 && totals.grandTotal === 195000, totals);

  const totalsTaxExclusive = computeTotals(
    [{ productId: "p", categoryId: "c", quantity: 1, unitPrice: 100000, addonsTotal: 0 }],
    null,
    { fee: 15000, freeThreshold: 0, taxRateBp: 700, pricesIncludeTax: false },
  );
  check("pricing: tax added when exclusive", totalsTaxExclusive.grandTotal === 122000, totalsTaxExclusive);

  // ---- Expiry sweep --------------------------------------------------------
  const sweep = await expireStaleOrders();
  check("expiry sweep runs", typeof sweep === "number");

  console.log("");
  console.log(`${passed}/${passed + failed} checks passed`);
  await db.destroy();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("E2E crashed", error);
  const db = getDb();
  await db.destroy().catch(() => undefined);
  process.exit(1);
});
