"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrderAccess, grantOrderAccess } from "@/lib/order-access";
import { getOrderByNumber } from "@/lib/orders";
import { cancelOrder } from "@/lib/checkout";
import { submitBankTransferProof, simulateSandboxPayment } from "@/lib/payments";
import { notifyAdmins } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { asLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import type { FormState } from "@/lib/schemas";
import { transitionOrder, addOrderEvent } from "@/lib/orders";

async function loadAccessibleOrder(orderNumber: string) {
  const order = await getOrderByNumber(orderNumber);
  if (!order) return null;
  const user = await getCurrentUser();
  if (order.userId && user?.id === order.userId) return order;
  if (await hasOrderAccess(order.id)) return order;
  return null;
}

export async function submitTransferProofAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  if (reference.length < 3) {
    return { ok: false, error: translate(locale, "validation.required"), fieldErrors: { reference: translate(locale, "validation.required") } };
  }

  const order = await loadAccessibleOrder(orderNumber);
  if (!order) return { ok: false, error: translate(locale, "error.forbidden") };

  const limit = await rateLimit(`proof:${order.id}`, 5, 3600);
  if (!limit.ok) return { ok: false, error: translate(locale, "error.rateLimit") };

  const payment = order.payments.find((item) => item.method === "bank_transfer");
  if (!payment) return { ok: false, error: translate(locale, "error.paymentNotConfigured") };

  const result = await submitBankTransferProof(payment.id, reference);
  if (!result.ok) return { ok: false, error: translate(locale, (result.error ?? "error.generic") as never) };

  revalidatePath(`/${locale}/order/${orderNumber}`);
  return { ok: true, message: translate(locale, "payment.slipUploaded") };
}

export async function simulateSandboxAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const order = await loadAccessibleOrder(orderNumber);
  if (!order) return;
  const payment = order.payments[0];
  if (!payment) return;
  await simulateSandboxPayment(payment.id);
  revalidatePath(`/${locale}/order/${orderNumber}`);
}

export async function cancelMyOrderAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const order = await loadAccessibleOrder(orderNumber);
  if (!order) redirect(`/${locale}/order/track`);
  const user = await getCurrentUser();

  const result = await cancelOrder({
    orderId: order.id,
    reason: "Cancelled by customer",
    actorType: "customer",
    actorId: user?.id ?? null,
  });
  if (result.ok) {
    await notifyAdmins("order_cancelled", {
      titleTh: "ลูกค้ายกเลิกคำสั่งซื้อ",
      titleEn: "Customer cancelled an order",
      bodyTh: order.orderNumber,
      bodyEn: order.orderNumber,
      linkUrl: `/${locale}/admin/orders/${order.id}`,
    });
  }
  revalidatePath(`/${locale}/order/${orderNumber}`);
  redirect(`/${locale}/order/${orderNumber}?cancelled=${result.ok ? "1" : "0"}`);
}

export async function requestRefundAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 400);
  const order = await loadAccessibleOrder(orderNumber);
  if (!order) redirect(`/${locale}/order/track`);
  const user = await getCurrentUser();

  if (order.paymentStatus !== "succeeded") {
    redirect(`/${locale}/order/${orderNumber}?refund=0`);
  }

  const transition = await transitionOrder({
    orderId: order.id,
    to: "refund_requested",
    actorType: "customer",
    actorId: user?.id ?? null,
    message: reason || "Refund requested by customer",
  });
  if (transition.ok) {
    await addOrderEvent({
      orderId: order.id,
      type: "refund_request",
      message: reason || "Refund requested by customer",
      actorType: "customer",
      actorId: user?.id ?? null,
    });
    await notifyAdmins("refund_requested", {
      titleTh: "มีคำขอคืนเงิน",
      titleEn: "Refund requested",
      bodyTh: `${order.orderNumber} — ${reason}`,
      bodyEn: `${order.orderNumber} — ${reason}`,
      linkUrl: `/${locale}/admin/orders/${order.id}`,
    });
    await db.updateTable("orders").set({ updated_at: nowIso() }).where("id", "=", order.id).execute();
  }
  revalidatePath(`/${locale}/order/${orderNumber}`);
  redirect(`/${locale}/order/${orderNumber}?refund=${transition.ok ? "1" : "0"}`);
}

export async function trackOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const orderNumber = String(formData.get("orderNumber") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!orderNumber || !email) {
    return { ok: false, error: translate(locale, "validation.required") };
  }
  const limit = await rateLimit(`track:${orderNumber}`, 10, 900);
  if (!limit.ok) return { ok: false, error: translate(locale, "error.rateLimit") };

  const order = await getOrderByNumber(orderNumber);
  if (!order || order.email.toLowerCase() !== email) {
    return { ok: false, error: translate(locale, "order.track.notFound") };
  }
  await grantOrderAccess(order.id);
  redirect(`/${locale}/order/${order.orderNumber}`);
}
