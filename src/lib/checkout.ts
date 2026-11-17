import { sql } from "kysely";
import { db, nowIso, parseJson } from "@/lib/db";
import { env } from "@/lib/env";
import { ids, formatOrderNumber } from "@/lib/ids";

import { getSettingsFresh } from "@/lib/settings";
import { computeTotals } from "@/lib/pricing";
import { findActiveCart, evaluateCoupon } from "@/lib/cart";
import { releaseSlot, reserveSlot, slotLabel, validateDeliveryDate } from "@/lib/delivery";
import type { CheckoutInput } from "@/lib/schemas";
import type { Locale } from "@/lib/i18n/config";

export class CheckoutError extends Error {
  constructor(
    public code: string,
    public field?: string,
  ) {
    super(code);
    this.name = "CheckoutError";
  }
}

export type PlaceOrderResult = {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  grandTotal: number;
  paymentMethod: string;
  reused: boolean;
};

type CheckoutContext = {
  userId: string | null;
  guestToken: string | null;
  locale: Locale;
  ip: string | null;
  userAgent: string | null;
};

type StockLine = {
  cartItemId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  sku: string;
  nameTh: string;
  nameEn: string;
  variantNameTh: string | null;
  variantNameEn: string | null;
  unitPrice: number;
  addonsTotal: number;
  addons: Array<{ id: string; nameTh: string; nameEn: string; price: number; sku: string }>;
  imageUrl: string | null;
  productStock: number;
  variantStock: number | null;
  categoryId: string | null;
  productPrice: number;
  salePrice: number | null;
};

async function loadCheckoutLines(cartId: string): Promise<StockLine[]> {
  const rows = await db
    .selectFrom("cart_items as ci")
    .innerJoin("products as p", "p.id", "ci.product_id")
    .leftJoin("product_variants as v", "v.id", "ci.variant_id")
    .leftJoin("product_translations as pt", (join) =>
      join.onRef("pt.product_id", "=", "ci.product_id").on("pt.locale", "=", "th"),
    )
    .leftJoin("product_translations as pte", (join) =>
      join.onRef("pte.product_id", "=", "ci.product_id").on("pte.locale", "=", "en"),
    )
    .select([
      "ci.id as cartItemId",
      "ci.product_id as productId",
      "ci.variant_id as variantId",
      "ci.quantity",
      "ci.addon_ids as addonIds",
      "p.sku",
      "p.stock_quantity as productStock",
      "p.price as productPrice",
      "p.sale_price as salePrice",
      "p.category_id as categoryId",
      "p.status",
      "p.deleted_at as deletedAt",
      "v.stock_quantity as variantStock",
      "v.price_delta as variantDelta",
      "v.status as variantStatus",
      "v.sku as variantSku",
      "v.name_th as variantNameTh",
      "v.name_en as variantNameEn",
      "pt.name as nameTh",
      "pte.name as nameEn",
      sql<string | null>`(select url from product_images where product_id = p.id order by sort_order asc limit 1)`.as(
        "imageUrl",
      ),
    ])
    .where("ci.cart_id", "=", cartId)
    .orderBy("ci.created_at", "asc")
    .execute();

  const addonIds = [...new Set(rows.flatMap((row) => parseJson<string[]>(row.addonIds, [])))];
  const addonRows = addonIds.length
    ? await db.selectFrom("addons").selectAll().where("id", "in", addonIds).execute()
    : [];
  const addonMap = new Map(addonRows.map((addon) => [addon.id, addon]));

  return rows.map((row) => {
    if (row.deletedAt || row.status !== "published") throw new CheckoutError("error.stock");
    if (row.variantId && row.variantStatus !== "active") throw new CheckoutError("error.stock");
    const addonIdsForLine = parseJson<string[]>(row.addonIds, []);
    const addons = addonIdsForLine.map((id) => {
      const addon = addonMap.get(id);
      if (!addon || addon.status !== "active") throw new CheckoutError("error.stock");
      return {
        id: addon.id,
        nameTh: addon.name_th,
        nameEn: addon.name_en,
        price: addon.price,
        sku: addon.sku,
      };
    });
    const base = row.salePrice !== null && row.salePrice < row.productPrice ? row.salePrice : row.productPrice;
    return {
      cartItemId: row.cartItemId,
      productId: row.productId,
      variantId: row.variantId,
      quantity: row.quantity,
      sku: row.variantSku ? `${row.sku}-${row.variantSku}` : row.sku,
      nameTh: row.nameTh ?? row.sku,
      nameEn: row.nameEn ?? row.nameTh ?? row.sku,
      variantNameTh: row.variantNameTh ?? null,
      variantNameEn: row.variantNameEn ?? null,
      unitPrice: base + (row.variantDelta ?? 0),
      addonsTotal: addons.reduce((sum, addon) => sum + addon.price, 0),
      addons,
      imageUrl: row.imageUrl,
      productStock: row.productStock,
      variantStock: row.variantStock,
      categoryId: row.categoryId,
      productPrice: row.productPrice,
      salePrice: row.salePrice,
    };
  });
}

async function nextOrderSequence(tx: typeof db): Promise<number> {
  const row = await tx.selectFrom("sequences").select("value").where("name", "=", "order").executeTakeFirst();
  if (!row) {
    await tx.insertInto("sequences").values({ name: "order", value: 1 }).execute();
    return 1;
  }
  const next = row.value + 1;
  await tx.updateTable("sequences").set({ value: next }).where("name", "=", "order").execute();
  return next;
}

/**
 * Creates an order inside a single database transaction.
 * Any failure (stock, coupon, delivery capacity, idempotency) rolls back
 * every write — including stock decrements and slot reservations.
 */
export async function placeOrder(input: CheckoutInput, ctx: CheckoutContext): Promise<PlaceOrderResult> {
  const existing = await db
    .selectFrom("orders")
    .select(["id", "order_number", "grand_total"])
    .where("idempotency_key", "=", input.idempotencyKey)
    .executeTakeFirst();

  if (existing) {
    const payment = await db
      .selectFrom("payments")
      .select(["id", "method"])
      .where("order_id", "=", existing.id)
      .orderBy("created_at", "asc")
      .executeTakeFirst();
    return {
      orderId: existing.id,
      orderNumber: existing.order_number,
      paymentId: payment?.id ?? "",
      grandTotal: existing.grand_total,
      paymentMethod: payment?.method ?? input.paymentMethod,
      reused: true,
    };
  }

  const settings = await getSettingsFresh();
  const dateCheck = validateDeliveryDate(input.deliveryDate, settings);
  if (!dateCheck.ok) throw new CheckoutError(dateCheck.reason ?? "error.dateInvalid", "deliveryDate");

  if (!settings.payment.methods.includes(input.paymentMethod) && input.paymentMethod !== "cod") {
    throw new CheckoutError("error.paymentNotConfigured", "paymentMethod");
  }
  if (input.paymentMethod === "cod" && !settings.payment.codEnabled) {
    throw new CheckoutError("error.paymentNotConfigured", "paymentMethod");
  }

  const cart = await findActiveCart(ctx.userId, ctx.guestToken);
  if (!cart) throw new CheckoutError("error.cartEmpty");

  const lines = await loadCheckoutLines(cart.id);
  if (lines.length === 0) throw new CheckoutError("error.cartEmpty");

  const now = nowIso();
  const orderId = ids.order();
  const paymentId = ids.payment();
  let orderNumber = "";
  let grandTotal = 0;
  let discountTotal = 0;

  const pricingLines = lines.map((line) => ({
    productId: line.productId,
    categoryId: line.categoryId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    addonsTotal: line.addonsTotal,
  }));

  const merchandise = lines.reduce((sum, line) => sum + (line.unitPrice + line.addonsTotal) * line.quantity, 0);
  if (settings.commerce.minOrderTotal > 0 && merchandise < settings.commerce.minOrderTotal) {
    throw new CheckoutError("error.stock");
  }

  const coupon = cart.coupon_code
    ? await evaluateCoupon(cart.coupon_code, pricingLines, { userId: ctx.userId, email: input.email })
    : null;
  if (cart.coupon_code && !coupon?.ok) throw new CheckoutError(coupon?.error ?? "error.couponInvalid");

  const totals = computeTotals(pricingLines, coupon?.ok ? coupon.rules : null, {
    fee: settings.shipping.fee,
    freeThreshold: settings.shipping.freeThreshold,
    taxRateBp: settings.commerce.taxRateBp,
    pricesIncludeTax: settings.commerce.pricesIncludeTax,
  });
  discountTotal = totals.discountTotal;
  grandTotal = totals.grandTotal;

  try {
    await db.transaction().execute(async (tx) => {
      // 1. Reserve delivery capacity atomically.
      const slotId = await reserveSlot(tx as unknown as typeof db, {
        date: input.deliveryDate,
        start: input.slotStart,
        end: input.slotEnd,
        capacity: settings.shipping.defaultCapacity,
      });
      if (!slotId) throw new CheckoutError("error.slotFull", "slotStart");

      // 2. Decrement stock with a conditional guard so concurrent buyers cannot oversell.
      for (const line of lines) {
        const updated = await tx
          .updateTable("products")
          .set((eb) => ({ stock_quantity: eb("stock_quantity", "-", line.quantity), updated_at: now }))
          .where("id", "=", line.productId)
          .where("stock_quantity", ">=", line.quantity)
          .returning("id")
          .executeTakeFirst();
        if (!updated) throw new CheckoutError("error.stock");

        if (line.variantId) {
          const variantUpdated = await tx
            .updateTable("product_variants")
            .set((eb) => ({ stock_quantity: eb("stock_quantity", "-", line.quantity), updated_at: now }))
            .where("id", "=", line.variantId)
            .where("stock_quantity", ">=", line.quantity)
            .returning("id")
            .executeTakeFirst();
          if (!variantUpdated) throw new CheckoutError("error.stock");
        }

        await tx
          .insertInto("inventory_movements")
          .values({
            id: ids.inventoryMovement(),
            product_id: line.productId,
            variant_id: line.variantId,
            type: "sale",
            quantity: -line.quantity,
            reference_type: "order",
            reference_id: orderId,
            note: null,
            created_by: ctx.userId,
            created_at: now,
          })
          .execute();
      }

      // 3. Create the order.
      orderNumber = formatOrderNumber(new Date(), await nextOrderSequence(tx as unknown as typeof db));
      await tx
        .insertInto("orders")
        .values({
          id: orderId,
          order_number: orderNumber,
          user_id: ctx.userId,
          locale: ctx.locale,
          status: input.paymentMethod === "cod" ? "confirmed" : "pending_payment",
          payment_status: "pending",
          email: input.email,
          customer_name: input.contactName,
          customer_phone: input.phone,
          recipient_name: input.recipientName,
          recipient_phone: input.recipientPhone,
          address_line: input.addressLine,
          subdistrict: input.subdistrict,
          district: input.district,
          province: input.province,
          postal_code: input.postalCode,
          delivery_notes: input.deliveryNotes || null,
          delivery_date: input.deliveryDate,
          delivery_slot_id: slotId,
          delivery_slot_label: slotLabel(input.slotStart, input.slotEnd),
          gift_message: input.giftMessage || null,
          sender_name: input.anonymous ? null : input.senderName || null,
          anonymous: input.anonymous ? 1 : 0,
          card_design: input.cardDesign,
          subtotal: totals.subtotal,
          addons_total: totals.addonsTotal,
          discount_total: totals.discountTotal,
          shipping_total: totals.shippingTotal,
          tax_total: totals.taxTotal,
          grand_total: totals.grandTotal,
          currency: settings.commerce.currency,
          coupon_code: coupon?.ok ? coupon.code : null,
          coupon_id: coupon?.ok ? coupon.rules?.id ?? null : null,
          customer_note: input.customerNote || null,
          internal_note: null,
          idempotency_key: input.idempotencyKey,
          ip: ctx.ip,
          user_agent: ctx.userAgent,
          created_at: now,
          updated_at: now,
          paid_at: null,
          confirmed_at: input.paymentMethod === "cod" ? now : null,
          preparing_at: null,
          ready_at: null,
          out_for_delivery_at: null,
          delivered_at: null,
          cancelled_at: null,
          cancel_reason: null,
          refunded_total: 0,
        })
        .execute();

      // 4. Snapshot every line so history survives catalog changes.
      for (const line of lines) {
        await tx
          .insertInto("order_items")
          .values({
            id: ids.orderItem(),
            order_id: orderId,
            product_id: line.productId,
            variant_id: line.variantId,
            sku: line.sku,
            name_th: line.nameTh,
            name_en: line.nameEn,
            variant_name_th: line.variantNameTh,
            variant_name_en: line.variantNameEn,
            unit_price: line.unitPrice,
            quantity: line.quantity,
            addons_json: JSON.stringify(
              line.addons.map((addon) => ({ id: addon.id, sku: addon.sku, nameTh: addon.nameTh, nameEn: addon.nameEn, price: addon.price })),
            ),
            addons_total: line.addonsTotal,
            line_total: (line.unitPrice + line.addonsTotal) * line.quantity,
            image_url: line.imageUrl,
            snapshot_json: JSON.stringify({
              productId: line.productId,
              variantId: line.variantId,
              price: line.unitPrice,
              productPrice: line.productPrice,
              salePrice: line.salePrice,
              capturedAt: now,
            }),
            created_at: now,
          })
          .execute();
      }

      // 5. Record coupon usage (unique per order — prevents double redemption).
      if (coupon?.ok && coupon.rules && discountTotal > 0) {
        await tx
          .insertInto("coupon_usages")
          .values({
            id: ids.couponUsage(),
            coupon_id: coupon.rules.id,
            user_id: ctx.userId,
            order_id: orderId,
            email: input.email,
            created_at: now,
          })
          .execute();
      }

      // 6. Payment record — a QR or redirect is never proof of payment.
      await tx
        .insertInto("payments")
        .values({
          id: paymentId,
          order_id: orderId,
          provider: env.payments.provider,
          method: input.paymentMethod,
          status: "pending",
          amount: totals.grandTotal,
          currency: settings.commerce.currency,
          provider_reference: null,
          checkout_url: null,
          qr_payload: null,
          expires_at:
            input.paymentMethod === "cod"
              ? null
              : new Date(Date.now() + settings.payment.promptpayExpiryMinutes * 60_000).toISOString(),
          paid_at: null,
          failure_reason: null,
          metadata_json: null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      await tx
        .insertInto("order_events")
        .values({
          id: ids.orderEvent(),
          order_id: orderId,
          type: "created",
          message: "Order created",
          from_status: null,
          to_status: input.paymentMethod === "cod" ? "confirmed" : "pending_payment",
          actor_type: ctx.userId ? "customer" : "system",
          actor_id: ctx.userId,
          visible_to_customer: 1,
          created_at: now,
        })
        .execute();

      await tx.insertInto("shipping").values({
        id: ids.shipping(),
        order_id: orderId,
        carrier: null,
        tracking_number: null,
        status: "preparing",
        note: null,
        shipped_at: null,
        delivered_at: null,
        created_at: now,
        updated_at: now,
      }).execute();

      await tx.deleteFrom("cart_items").where("cart_id", "=", cart.id).execute();
      await tx
        .updateTable("carts")
        .set({ status: "converted", coupon_code: null, updated_at: now })
        .where("id", "=", cart.id)
        .execute();
    });
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    // Unique idempotency race: another request created the order first.
    const raced = await db
      .selectFrom("orders")
      .select(["id", "order_number", "grand_total"])
      .where("idempotency_key", "=", input.idempotencyKey)
      .executeTakeFirst();
    if (raced) {
      const payment = await db
        .selectFrom("payments")
        .select(["id", "method"])
        .where("order_id", "=", raced.id)
        .orderBy("created_at", "asc")
        .executeTakeFirst();
      return {
        orderId: raced.id,
        orderNumber: raced.order_number,
        paymentId: payment?.id ?? "",
        grandTotal: raced.grand_total,
        paymentMethod: payment?.method ?? input.paymentMethod,
        reused: true,
      };
    }
    throw error;
  }

  return {
    orderId,
    orderNumber,
    paymentId,
    grandTotal,
    paymentMethod: input.paymentMethod,
    reused: false,
  };
}

const CANCELLABLE = new Set(["pending_payment", "awaiting_verification", "paid", "confirmed", "preparing"]);

/** Cancels an unpaid order, restocks every line and frees delivery capacity. */
export async function cancelOrder(params: {
  orderId: string;
  reason: string;
  actorType: "customer" | "admin" | "system";
  actorId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const order = await db.selectFrom("orders").selectAll().where("id", "=", params.orderId).executeTakeFirst();
  if (!order) return { ok: false, error: "common.notFound" };
  if (order.status === "cancelled") return { ok: true };
  if (!CANCELLABLE.has(order.status)) return { ok: false, error: "order.cannotCancel" };
  if (["succeeded", "partially_refunded", "refunded"].includes(order.payment_status)) {
    return { ok: false, error: "order.cannotCancel" };
  }

  const now = nowIso();
  await db.transaction().execute(async (tx) => {
    const items = await tx.selectFrom("order_items").selectAll().where("order_id", "=", params.orderId).execute();
    for (const item of items) {
      if (!item.product_id) continue;
      await tx
        .updateTable("products")
        .set((eb) => ({ stock_quantity: eb("stock_quantity", "+", item.quantity) }))
        .where("id", "=", item.product_id)
        .execute();
      if (item.variant_id) {
        await tx
          .updateTable("product_variants")
          .set((eb) => ({ stock_quantity: eb("stock_quantity", "+", item.quantity) }))
          .where("id", "=", item.variant_id)
          .execute();
      }
      await tx
        .insertInto("inventory_movements")
        .values({
          id: ids.inventoryMovement(),
          product_id: item.product_id,
          variant_id: item.variant_id,
          type: "release",
          quantity: item.quantity,
          reference_type: "order_cancel",
          reference_id: params.orderId,
          note: params.reason,
          created_by: params.actorId,
          created_at: now,
        })
        .execute();
    }

    await tx
      .updateTable("orders")
      .set({
        status: "cancelled",
        cancelled_at: now,
        cancel_reason: params.reason,
        payment_status: order.payment_status === "pending" ? "cancelled" : order.payment_status,
        updated_at: now,
      })
      .where("id", "=", params.orderId)
      .execute();

    await tx
      .updateTable("payments")
      .set({ status: "cancelled", updated_at: now })
      .where("order_id", "=", params.orderId)
      .where("status", "in", ["pending", "processing", "awaiting_verification"])
      .execute();

    await tx
      .insertInto("order_events")
      .values({
        id: ids.orderEvent(),
        order_id: params.orderId,
        type: "cancelled",
        message: params.reason,
        from_status: order.status,
        to_status: "cancelled",
        actor_type: params.actorType,
        actor_id: params.actorId,
        visible_to_customer: 1,
        created_at: now,
      })
      .execute();
  });

  await releaseSlot(order.delivery_slot_id);
  return { ok: true };
}

/** Expires unpaid orders past their payment window and returns stock. */
export async function expireStaleOrders(): Promise<number> {
  const cutoff = nowIso();
  const stale = await db
    .selectFrom("orders")
    .innerJoin("payments", "payments.order_id", "orders.id")
    .select(["orders.id"])
    .where("orders.status", "=", "pending_payment")
    .where("payments.status", "=", "pending")
    .where("payments.expires_at", "is not", null)
    .where("payments.expires_at", "<", cutoff)
    .limit(50)
    .execute();

  let expired = 0;
  for (const row of stale) {
    const result = await cancelOrder({
      orderId: row.id,
      reason: "Payment window expired",
      actorType: "system",
      actorId: null,
    });
    if (result.ok) {
      await db
        .updateTable("payments")
        .set({ status: "expired", updated_at: nowIso() })
        .where("order_id", "=", row.id)
        .where("status", "=", "pending")
        .execute();
      expired += 1;
    }
  }
  return expired;
}
