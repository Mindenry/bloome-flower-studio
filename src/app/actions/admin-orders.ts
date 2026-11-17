"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { transitionOrder, addOrderEvent } from "@/lib/orders";
import { markPaymentSucceeded, processRefund } from "@/lib/payments";
import { cancelOrder } from "@/lib/checkout";
import { notifyCustomer } from "@/lib/notify";
import { logActivity } from "@/lib/audit";
import { sendStatusUpdateEmail } from "@/lib/email";
import type { OrderStatus } from "@/lib/db/schema";
import type { FormState } from "@/lib/schemas";

async function guard(locale: Locale, permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, permission)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "ชำระเงินแล้ว",
  confirmed: "ยืนยันคำสั่งซื้อ",
  preparing: "กำลังเตรียมสินค้า",
  arranging: "กำลังจัดดอกไม้",
  quality_check: "ตรวจสอบคุณภาพ",
  ready_for_delivery: "พร้อมจัดส่ง",
  out_for_delivery: "กำลังจัดส่ง",
  delivered: "จัดส่งสำเร็จ",
  cancelled: "ยกเลิก",
  refund_requested: "ขอคืนเงิน",
  refunded: "คืนเงินแล้ว",
  pending_payment: "รอชำระเงิน",
  awaiting_verification: "รอตรวจสอบการชำระเงิน",
};

export async function updateOrderStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.ORDER_UPDATE);
  const orderId = String(formData.get("orderId") ?? "");
  const to = String(formData.get("status") ?? "") as OrderStatus;
  const message = String(formData.get("message") ?? "").slice(0, 400);

  const order = await db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!order) return { ok: false, error: translate(locale, "common.notFound") };

  if (to === "cancelled") {
    const result = await cancelOrder({
      orderId,
      reason: message || "Cancelled by staff",
      actorType: "admin",
      actorId: user.id,
    });
    if (!result.ok) return { ok: false, error: translate(locale, (result.error ?? "order.cannotCancel") as never) };
    await logActivity({ actor: user, action: "order.cancel", entityType: "order", entityId: orderId });
    revalidatePath(`/${locale}/admin/orders/${orderId}`);
    return { ok: true, message: translate(locale, "order.cancelled") };
  }

  const result = await transitionOrder({
    orderId,
    to,
    actorType: "admin",
    actorId: user.id,
    message: message || STATUS_LABEL[to] || to,
    allowPaymentPending: to === "refund_requested" || to === "refunded",
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        order.payment_status !== "succeeded"
          ? translate(locale, "error.paymentNotConfigured")
          : translate(locale, "order.cannotCancel"),
    };
  }

  if (["out_for_delivery", "delivered"].includes(to) && order.email) {
    await sendStatusUpdateEmail({
      to: order.email,
      locale: order.locale as Locale,
      name: order.customer_name,
      orderNumber: order.order_number,
      statusKey: to === "out_for_delivery" ? "order.status.out_for_delivery" : "order.status.delivered",
    }).catch(() => undefined);
  }
  if (order.user_id) {
    await notifyCustomer(order.user_id, `order_${to}`, {
      titleTh: `คำสั่งซื้อ ${order.order_number}`,
      titleEn: `Order ${order.order_number}`,
      bodyTh: STATUS_LABEL[to] ?? to,
      bodyEn: to.replace(/_/g, " "),
      linkUrl: `/${order.locale}/order/${order.order_number}`,
    }).catch(() => undefined);
  }
  if (to === "out_for_delivery") {
    await db
      .updateTable("shipping")
      .set({ shipped_at: nowIso(), status: "shipped", updated_at: nowIso() })
      .where("order_id", "=", orderId)
      .execute();
  }
  if (to === "delivered") {
    await db
      .updateTable("shipping")
      .set({ delivered_at: nowIso(), status: "delivered", updated_at: nowIso() })
      .where("order_id", "=", orderId)
      .execute();
  }

  await logActivity({ actor: user, action: "order.status", entityType: "order", entityId: orderId, meta: { to } });
  revalidatePath(`/${locale}/admin/orders/${orderId}`);
  revalidatePath(`/${locale}/admin/orders`);
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function verifyPaymentAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PAYMENT_MANAGE);
  const paymentId = String(formData.get("paymentId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const payment = await db.selectFrom("payments").selectAll().where("id", "=", paymentId).executeTakeFirst();
  if (!payment) return;

  await markPaymentSucceeded({
    paymentId,
    amount: payment.amount,
    currency: payment.currency,
    providerReference: payment.provider_reference,
    eventId: null,
    payload: { verifiedBy: user.id },
    source: "manual",
  });

  await logActivity({ actor: user, action: "payment.verify", entityType: "payment", entityId: paymentId });
  revalidatePath(`/${locale}/admin/orders/${orderId}`);
}

export async function addOrderNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.ORDER_VIEW);
  const orderId = String(formData.get("orderId") ?? "");
  const internalNote = String(formData.get("internalNote") ?? "").slice(0, 2000);
  const customerNote = String(formData.get("customerNote") ?? "").slice(0, 2000);

  await db
    .updateTable("orders")
    .set({ internal_note: internalNote || null, updated_at: nowIso() })
    .where("id", "=", orderId)
    .execute();

  if (internalNote) {
    await addOrderEvent({
      orderId,
      type: "note",
      message: internalNote,
      actorType: "admin",
      actorId: user.id,
      visibleToCustomer: false,
    });
  }
  if (customerNote) {
    await addOrderEvent({
      orderId,
      type: "note",
      message: customerNote,
      actorType: "admin",
      actorId: user.id,
      visibleToCustomer: true,
    });
    const order = await db.selectFrom("orders").select(["user_id", "order_number", "locale"]).where("id", "=", orderId).executeTakeFirst();
    if (order?.user_id) {
      await notifyCustomer(order.user_id, "order_note", {
        titleTh: `ข้อความเกี่ยวกับคำสั่งซื้อ ${order.order_number}`,
        titleEn: `Message about order ${order.order_number}`,
        bodyTh: customerNote,
        bodyEn: customerNote,
        linkUrl: `/${order.locale}/order/${order.order_number}`,
      });
    }
  }

  await logActivity({ actor: user, action: "order.note", entityType: "order", entityId: orderId });
  revalidatePath(`/${locale}/admin/orders/${orderId}`);
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function addTrackingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.ORDER_UPDATE);
  const orderId = String(formData.get("orderId") ?? "");
  const carrier = String(formData.get("carrier") ?? "").slice(0, 80);
  const trackingNumber = String(formData.get("trackingNumber") ?? "").slice(0, 120);
  const note = String(formData.get("note") ?? "").slice(0, 400);

  const existing = await db.selectFrom("shipping").select("id").where("order_id", "=", orderId).executeTakeFirst();
  const now = nowIso();
  if (existing) {
    await db
      .updateTable("shipping")
      .set({ carrier: carrier || null, tracking_number: trackingNumber || null, note: note || null, updated_at: now })
      .where("id", "=", existing.id)
      .execute();
  } else {
    await db
      .insertInto("shipping")
      .values({
        id: `shp_${Date.now().toString(32)}`,
        order_id: orderId,
        carrier: carrier || null,
        tracking_number: trackingNumber || null,
        status: "preparing",
        note: note || null,
        shipped_at: null,
        delivered_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }

  await logActivity({ actor: user, action: "order.tracking", entityType: "order", entityId: orderId, meta: { carrier, trackingNumber } });
  revalidatePath(`/${locale}/admin/orders/${orderId}`);
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function refundOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PAYMENT_MANAGE);
  const orderId = String(formData.get("orderId") ?? "");
  const amount = Math.round(Number(formData.get("amount") ?? 0));
  const reason = String(formData.get("reason") ?? "").slice(0, 400);
  const manual = String(formData.get("manual") ?? "") === "1";

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: translate(locale, "validation.positive") };
  }

  const result = await processRefund({ orderId, amount, reason, adminId: user.id, manual });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "manual_refund_required"
          ? locale === "th"
            ? "ผู้ให้บริการนี้ไม่รองรับการคืนเงินอัตโนมัติ กรุณาคืนเงินด้วยตนเองแล้วยืนยัน"
            : "This provider does not support API refunds. Refund manually, then confirm."
          : result.error ?? translate(locale, "error.generic"),
    };
  }
  await logActivity({ actor: user, action: "payment.refund", entityType: "order", entityId: orderId, meta: { amount, manual } });
  revalidatePath(`/${locale}/admin/orders/${orderId}`);
  return { ok: true, message: translate(locale, "common.saved") };
}
