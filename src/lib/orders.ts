import { db, nowIso, parseJson } from "@/lib/db";
import type { OrderStatus } from "@/lib/db/schema";
import { ids } from "@/lib/ids";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending_payment",
  "awaiting_verification",
  "paid",
  "confirmed",
  "preparing",
  "arranging",
  "quality_check",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refund_requested",
  "refunded",
];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "awaiting_verification", "cancelled"],
  awaiting_verification: ["paid", "cancelled"],
  paid: ["confirmed", "cancelled", "refund_requested"],
  confirmed: ["preparing", "cancelled", "refund_requested"],
  preparing: ["arranging", "cancelled", "refund_requested"],
  arranging: ["quality_check", "refund_requested"],
  quality_check: ["ready_for_delivery", "refund_requested"],
  ready_for_delivery: ["out_for_delivery", "refund_requested"],
  out_for_delivery: ["delivered", "refund_requested"],
  delivered: ["refund_requested"],
  cancelled: [],
  refund_requested: ["refunded", "delivered"],
  refunded: [],
};

export const STATUS_TIMESTAMP_FIELD: Partial<Record<OrderStatus, string>> = {
  paid: "paid_at",
  confirmed: "confirmed_at",
  preparing: "preparing_at",
  ready_for_delivery: "ready_at",
  out_for_delivery: "out_for_delivery_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

export function canTransition(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from as OrderStatus];
  return allowed ? allowed.includes(to as OrderStatus) : false;
}

export async function transitionOrder(params: {
  orderId: string;
  to: OrderStatus;
  actorType: "customer" | "admin" | "system";
  actorId: string | null;
  message: string;
  visibleToCustomer?: boolean;
  allowPaymentPending?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const order = await db
    .selectFrom("orders")
    .select(["id", "status", "payment_status"])
    .where("id", "=", params.orderId)
    .executeTakeFirst();
  if (!order) return { ok: false, error: "common.notFound" };
  if (order.status === params.to) return { ok: true };
  if (!canTransition(order.status, params.to)) return { ok: false, error: "order.cannotCancel" };

  const paidStates = ["succeeded", "partially_refunded"];
  const needsPayment =
    ["paid", "confirmed", "preparing", "arranging", "quality_check", "ready_for_delivery", "out_for_delivery", "delivered"].includes(
      params.to,
    ) && !paidStates.includes(order.payment_status);
  if (needsPayment && !params.allowPaymentPending) return { ok: false, error: "error.unauthorized" };

  const now = nowIso();
  const timestampField = STATUS_TIMESTAMP_FIELD[params.to];
  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable("orders")
      .set({
        status: params.to,
        updated_at: now,
        ...(timestampField ? { [timestampField]: now } : {}),
      })
      .where("id", "=", params.orderId)
      .execute();
    await tx
      .insertInto("order_events")
      .values({
        id: ids.orderEvent(),
        order_id: params.orderId,
        type: params.to,
        message: params.message,
        from_status: order.status,
        to_status: params.to,
        actor_type: params.actorType,
        actor_id: params.actorId,
        visible_to_customer: params.visibleToCustomer === false ? 0 : 1,
        created_at: now,
      })
      .execute();
  });
  return { ok: true };
}

export type OrderItemView = {
  id: string;
  productId: string | null;
  slug: string | null;
  sku: string;
  nameTh: string;
  nameEn: string;
  variantNameTh: string | null;
  variantNameEn: string | null;
  unitPrice: number;
  quantity: number;
  addons: Array<{ id: string; nameTh: string; nameEn: string; price: number; sku: string }>;
  addonsTotal: number;
  lineTotal: number;
  imageUrl: string | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: string;
  locale: string;
  email: string;
  customerName: string;
  customerPhone: string;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  deliveryNotes: string | null;
  deliveryDate: string | null;
  deliverySlotLabel: string | null;
  giftMessage: string | null;
  senderName: string | null;
  anonymous: boolean;
  cardDesign: string | null;
  subtotal: number;
  addonsTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  couponCode: string | null;
  customerNote: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  refundedTotal: number;
  items: OrderItemView[];
  events: Array<{ id: string; type: string; message: string; toStatus: string | null; createdAt: string; visible: boolean }>;
  payments: Array<{
    id: string;
    provider: string;
    method: string;
    status: string;
    amount: number;
    qrPayload: string | null;
    checkoutUrl: string | null;
    providerReference: string | null;
    expiresAt: string | null;
    paidAt: string | null;
  }>;
  shipping: { carrier: string | null; trackingNumber: string | null; status: string; shippedAt: string | null } | null;
};

type OrderRow = Awaited<ReturnType<typeof fetchOrderRow>>;

async function fetchOrderRow(orderId: string) {
  return db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst();
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const order = await fetchOrderRow(orderId);
  if (!order) return null;
  return hydrateOrder(order as NonNullable<OrderRow>);
}

async function hydrateOrder(order: NonNullable<OrderRow>): Promise<OrderDetail> {
  const [items, events, payments, shipping] = await Promise.all([
    db.selectFrom("order_items").selectAll().where("order_id", "=", order.id).execute(),
    db
      .selectFrom("order_events")
      .selectAll()
      .where("order_id", "=", order.id)
      .orderBy("created_at", "asc")
      .execute(),
    db.selectFrom("payments").selectAll().where("order_id", "=", order.id).orderBy("created_at", "asc").execute(),
    db.selectFrom("shipping").selectAll().where("order_id", "=", order.id).executeTakeFirst(),
  ]);

  const productIds = items.map((item) => item.product_id).filter(Boolean) as string[];
  const products = productIds.length
    ? await db.selectFrom("products").select(["id", "slug"]).where("id", "in", productIds).execute()
    : [];
  const slugMap = new Map(products.map((product) => [product.id, product.slug]));

  return {
    id: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    status: order.status as OrderStatus,
    paymentStatus: order.payment_status,
    locale: order.locale,
    email: order.email,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    recipientName: order.recipient_name,
    recipientPhone: order.recipient_phone,
    addressLine: order.address_line,
    subdistrict: order.subdistrict,
    district: order.district,
    province: order.province,
    postalCode: order.postal_code,
    deliveryNotes: order.delivery_notes,
    deliveryDate: order.delivery_date,
    deliverySlotLabel: order.delivery_slot_label,
    giftMessage: order.gift_message,
    senderName: order.sender_name,
    anonymous: order.anonymous === 1,
    cardDesign: order.card_design,
    subtotal: order.subtotal,
    addonsTotal: order.addons_total,
    discountTotal: order.discount_total,
    shippingTotal: order.shipping_total,
    taxTotal: order.tax_total,
    grandTotal: order.grand_total,
    currency: order.currency,
    couponCode: order.coupon_code,
    customerNote: order.customer_note,
    internalNote: order.internal_note,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    paidAt: order.paid_at,
    cancelledAt: order.cancelled_at,
    cancelReason: order.cancel_reason,
    refundedTotal: order.refunded_total,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      slug: item.product_id ? (slugMap.get(item.product_id) ?? null) : null,
      sku: item.sku,
      nameTh: item.name_th,
      nameEn: item.name_en,
      variantNameTh: item.variant_name_th,
      variantNameEn: item.variant_name_en,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      addons: parseJson<Array<{ id: string; nameTh: string; nameEn: string; price: number; sku: string }>>(
        item.addons_json,
        [],
      ),
      addonsTotal: item.addons_total,
      lineTotal: item.line_total,
      imageUrl: item.image_url,
    })),
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      toStatus: event.to_status,
      createdAt: event.created_at,
      visible: event.visible_to_customer === 1,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      qrPayload: payment.qr_payload,
      checkoutUrl: payment.checkout_url,
      providerReference: payment.provider_reference,
      expiresAt: payment.expires_at,
      paidAt: payment.paid_at,
    })),
    shipping: shipping
      ? {
          carrier: shipping.carrier,
          trackingNumber: shipping.tracking_number,
          status: shipping.status,
          shippedAt: shipping.shipped_at,
        }
      : null,
  };
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderDetail | null> {
  const row = await db.selectFrom("orders").select("id").where("order_number", "=", orderNumber).executeTakeFirst();
  if (!row) return null;
  return hydrateOrder((await fetchOrderRow(row.id))!);
}

export async function getUserOrder(userId: string, orderNumber: string): Promise<OrderDetail | null> {
  const row = await db
    .selectFrom("orders")
    .select("id")
    .where("order_number", "=", orderNumber)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!row) return null;
  return hydrateOrder((await fetchOrderRow(row.id))!);
}

export async function listUserOrders(userId: string, limit = 20) {
  const rows = await db
    .selectFrom("orders")
    .select([
      "id",
      "order_number",
      "status",
      "payment_status",
      "grand_total",
      "currency",
      "created_at",
      "delivery_date",
      "recipient_name",
    ])
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute();
  const orderIds = rows.map((row) => row.id);
  const items = orderIds.length
    ? await db
        .selectFrom("order_items")
        .select(["order_id", "name_th", "name_en", "image_url", "quantity"])
        .where("order_id", "in", orderIds)
        .execute()
    : [];
  const itemMap = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemMap.get(item.order_id) ?? [];
    list.push(item);
    itemMap.set(item.order_id, list);
  }
  return rows.map((row) => ({
    ...row,
    items: itemMap.get(row.id) ?? [],
  }));
}

export type AdminOrderFilters = {
  query?: string;
  status?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
};

export async function adminListOrders(filters: AdminOrderFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 20));
  let base = db.selectFrom("orders");
  if (filters.query) {
    const term = `%${filters.query.trim().toLowerCase()}%`;
    base = base.where((eb) =>
      eb.or([
        eb(db.fn("lower", ["order_number"]), "like", term),
        eb(db.fn("lower", ["email"]), "like", term),
        eb(db.fn("lower", ["customer_name"]), "like", term),
        eb(db.fn("lower", ["recipient_name"]), "like", term),
      ]),
    );
  }
  if (filters.status) base = base.where("status", "=", filters.status);
  if (filters.paymentStatus) base = base.where("payment_status", "=", filters.paymentStatus);
  if (filters.from) base = base.where("created_at", ">=", filters.from);
  if (filters.to) base = base.where("created_at", "<=", filters.to);

  const countRow = await base.select(({ fn }) => fn.countAll<string>().as("count")).executeTakeFirst();
  const rows = await base
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();

  return {
    items: rows,
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(Number(countRow?.count ?? 0) / perPage)),
  };
}

export async function addOrderEvent(params: {
  orderId: string;
  type: string;
  message: string;
  actorType: "customer" | "admin" | "system";
  actorId: string | null;
  visibleToCustomer?: boolean;
  fromStatus?: string | null;
  toStatus?: string | null;
}): Promise<void> {
  await db
    .insertInto("order_events")
    .values({
      id: ids.orderEvent(),
      order_id: params.orderId,
      type: params.type,
      message: params.message,
      from_status: params.fromStatus ?? null,
      to_status: params.toStatus ?? null,
      actor_type: params.actorType,
      actor_id: params.actorId,
      visible_to_customer: params.visibleToCustomer === false ? 0 : 1,
      created_at: nowIso(),
    })
    .execute();
}
