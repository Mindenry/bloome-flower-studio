import { db, nowIso, parseJson } from "@/lib/db";
import { env } from "@/lib/env";
import { ids } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { ids as idFactory } from "@/lib/ids";
import { cancelOrder } from "@/lib/checkout";
import { notifyAdmins, notifyOrderEvent } from "@/lib/notify";
import { sendPaymentSucceededEmail, sendRefundEmail } from "@/lib/email";
import { getProvider } from "./providers";
import type { NormalizedEvent, PaymentMethod } from "./types";
import type { Locale } from "@/lib/i18n/config";

export { getProvider, PROVIDERS } from "./providers";

export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ["processing", "awaiting_verification", "succeeded", "failed", "expired", "cancelled"],
  processing: ["succeeded", "failed", "expired", "cancelled"],
  awaiting_verification: ["succeeded", "failed", "cancelled"],
  succeeded: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  failed: [],
  expired: [],
  cancelled: [],
  refunded: [],
};

export function canTransitionPayment(from: string, to: string): boolean {
  return (PAYMENT_TRANSITIONS[from] ?? []).includes(to);
}

function secretFor(providerId: string): string {
  if (providerId === "stripe") return env.payments.stripeWebhookSecret;
  if (providerId === "promptpay_omise") return env.payments.omiseWebhookKey;
  return env.authSecret;
}

export function webhookUrlFor(providerId: string): string {
  const base = `${env.appUrl}/api/webhooks/payments/${providerId}`;
  return providerId === "promptpay_omise" && env.payments.omiseWebhookKey
    ? `${base}?key=${encodeURIComponent(env.payments.omiseWebhookKey)}`
    : base;
}

/* -------------------------------------------------------------------------- */
/* Initiation                                                                  */
/* -------------------------------------------------------------------------- */

export async function initiatePayment(
  paymentId: string,
): Promise<{ ok: boolean; error?: string; checkoutUrl?: string | null; qrPayload?: string | null }> {
  const payment = await db.selectFrom("payments").selectAll().where("id", "=", paymentId).executeTakeFirst();
  if (!payment) return { ok: false, error: "common.notFound" };
  const order = await db.selectFrom("orders").selectAll().where("id", "=", payment.order_id).executeTakeFirst();
  if (!order) return { ok: false, error: "common.notFound" };

  if (payment.provider_reference && payment.status !== "failed") {
    return { ok: true, checkoutUrl: payment.checkout_url, qrPayload: payment.qr_payload };
  }
  if (payment.method === "cod") {
    return { ok: true, checkoutUrl: null, qrPayload: null };
  }

  let provider;
  try {
    provider = getProvider(payment.provider);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (!provider.supports.includes(payment.method as PaymentMethod)) {
    return { ok: false, error: "error.paymentNotConfigured" };
  }

  const returnUrl = `${env.appUrl}/${order.locale}/order/${order.order_number}`;
  const providerConfig = {
    stripe: Boolean(env.payments.stripeSecretKey),
    promptpay_omise: Boolean(env.payments.omiseSecretKey),
    manual_bank_transfer: true,
    sandbox: !env.isProduction,
  }[provider.id];

  if (!providerConfig) {
    return { ok: false, error: "error.paymentNotConfigured" };
  }

  try {
    const charge = await provider.createCharge({
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.order_number,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method as PaymentMethod,
      customer: { name: order.customer_name, email: order.email, phone: order.customer_phone },
      description: `BLOOMÉ order ${order.order_number}`,
      returnUrl,
      webhookUrl: webhookUrlFor(provider.id),
      expiresAt: payment.expires_at,
    });

    await db.transaction().execute(async (tx) => {
      await tx
        .updateTable("payments")
        .set({
          provider_reference: charge.providerReference,
          qr_payload: charge.qrPayload,
          checkout_url: charge.checkoutUrl,
          expires_at: charge.expiresAt ?? payment.expires_at,
          metadata_json: JSON.stringify(charge.raw).slice(0, 20_000),
          status:
            provider.id === "manual_bank_transfer"
              ? payment.status
              : payment.status === "pending"
                ? "processing"
                : payment.status,
          updated_at: nowIso(),
        })
        .where("id", "=", payment.id)
        .execute();
      await tx
        .insertInto("payment_transactions")
        .values({
          id: ids.paymentTransaction(),
          payment_id: payment.id,
          type: "charge",
          provider_event_id: null,
          amount: payment.amount,
          currency: payment.currency,
          status: "initiated",
          payload_json: JSON.stringify(charge.raw).slice(0, 20_000),
          note: null,
          created_at: nowIso(),
        })
        .execute();
    });

    return { ok: true, checkoutUrl: charge.checkoutUrl, qrPayload: charge.qrPayload };
  } catch (error) {
    const message = (error as Error).message;
    await db
      .insertInto("payment_transactions")
      .values({
        id: ids.paymentTransaction(),
        payment_id: payment.id,
        type: "charge",
        provider_event_id: null,
        amount: payment.amount,
        currency: payment.currency,
        status: "error",
        payload_json: null,
        note: message.slice(0, 500),
        created_at: nowIso(),
      })
      .execute();
    return { ok: false, error: message.startsWith("method_not_supported") ? "error.paymentNotConfigured" : "error.paymentNotConfigured" };
  }
}

/* -------------------------------------------------------------------------- */
/* State transitions                                                           */
/* -------------------------------------------------------------------------- */

export async function markPaymentSucceeded(params: {
  paymentId: string;
  amount: number | null;
  currency: string | null;
  providerReference: string | null;
  eventId: string | null;
  payload: unknown;
  source: "webhook" | "manual" | "sandbox";
}): Promise<{ ok: boolean; error?: string; already?: boolean }> {
  const payment = await db.selectFrom("payments").selectAll().where("id", "=", params.paymentId).executeTakeFirst();
  if (!payment) return { ok: false, error: "common.notFound" };
  if (payment.status === "succeeded" || payment.status === "partially_refunded" || payment.status === "refunded") {
    return { ok: true, already: true };
  }
  if (params.amount !== null && params.amount !== payment.amount) {
    await db
      .insertInto("payment_transactions")
      .values({
        id: ids.paymentTransaction(),
        payment_id: payment.id,
        type: "webhook",
        provider_event_id: params.eventId,
        amount: params.amount,
        currency: params.currency,
        status: "amount_mismatch",
        payload_json: JSON.stringify(params.payload).slice(0, 20_000),
        note: `expected ${payment.amount} received ${params.amount}`,
        created_at: nowIso(),
      })
      .execute()
      .catch(() => undefined);
    return { ok: false, error: "amount_mismatch" };
  }
  if (params.currency && params.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    return { ok: false, error: "currency_mismatch" };
  }
  if (!canTransitionPayment(payment.status, "succeeded")) {
    return { ok: false, error: "invalid_transition" };
  }

  const order = await db.selectFrom("orders").selectAll().where("id", "=", payment.order_id).executeTakeFirst();
  if (!order) return { ok: false, error: "common.notFound" };
  const now = nowIso();

  try {
    await db.transaction().execute(async (tx) => {
      const fresh = await tx.selectFrom("payments").select(["status"]).where("id", "=", payment.id).executeTakeFirst();
      if (!fresh || fresh.status === "succeeded") return;

      await tx
        .updateTable("payments")
        .set({
          status: "succeeded",
          paid_at: now,
          updated_at: now,
          provider_reference: params.providerReference ?? payment.provider_reference,
          failure_reason: null,
        })
        .where("id", "=", payment.id)
        .execute();

      await tx
        .updateTable("orders")
        .set({
          payment_status: "succeeded",
          status: ["pending_payment", "awaiting_verification"].includes(order.status) ? "paid" : order.status,
          paid_at: now,
          updated_at: now,
        })
        .where("id", "=", order.id)
        .execute();

      await tx
        .insertInto("order_events")
        .values({
          id: idFactory.orderEvent(),
          order_id: order.id,
          type: "payment_succeeded",
          message: params.source === "manual" ? "Payment verified by staff" : "Payment confirmed by provider",
          from_status: order.status,
          to_status: ["pending_payment", "awaiting_verification"].includes(order.status) ? "paid" : order.status,
          actor_type: params.source === "manual" ? "admin" : "system",
          actor_id: null,
          visible_to_customer: 1,
          created_at: now,
        })
        .execute();

      // Sales counters used by "best sellers" — only ever incremented by real paid orders.
      const items = await tx.selectFrom("order_items").selectAll().where("order_id", "=", order.id).execute();
      for (const item of items) {
        if (!item.product_id) continue;
        await tx
          .updateTable("products")
          .set((eb) => ({ sold_count: eb("sold_count", "+", item.quantity) }))
          .where("id", "=", item.product_id)
          .execute();
      }

      if (params.eventId) {
        const duplicate = await tx
          .selectFrom("payment_transactions")
          .select("id")
          .where("provider_event_id", "=", params.eventId)
          .executeTakeFirst();
        if (duplicate) return;
      }
      await tx
        .insertInto("payment_transactions")
        .values({
          id: ids.paymentTransaction(),
          payment_id: payment.id,
          type: params.source === "manual" ? "verify" : "webhook",
          provider_event_id: params.eventId,
          amount: payment.amount,
          currency: payment.currency,
          status: "succeeded",
          payload_json: JSON.stringify(params.payload).slice(0, 20_000),
          note: params.source,
          created_at: now,
        })
        .execute();
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  const locale = order.locale as Locale;
  await Promise.all([
    sendPaymentSucceededEmail({
      to: order.email,
      locale,
      name: order.customer_name,
      orderNumber: order.order_number,
      total: payment.amount,
    }),
    notifyOrderEvent({
      userId: order.user_id,
      email: order.email,
      locale,
      type: "payment_succeeded",
      payload: {
        titleTh: "ได้รับชำระเงินแล้ว",
        titleEn: "Payment received",
        bodyTh: `คำสั่งซื้อ ${order.order_number}`,
        bodyEn: `Order ${order.order_number}`,
        linkUrl: `/${locale}/order/${order.order_number}`,
      },
      lineMessage: `BLOOMÉ: ได้รับชำระเงินสำหรับคำสั่งซื้อ ${order.order_number} แล้ว`,
    }).then(() => undefined)
      .catch(() => undefined),
    notifyAdmins("payment_succeeded", {
      titleTh: "มีการชำระเงินใหม่",
      titleEn: "New payment received",
      bodyTh: `${order.order_number} · ฿${(payment.amount / 100).toLocaleString("th-TH")}`,
      bodyEn: `${order.order_number} · THB ${(payment.amount / 100).toLocaleString("en-US")}`,
      linkUrl: `/${locale}/admin/orders/${order.id}`,
    }),
  ]);

  return { ok: true };
}

export async function markPaymentFailed(params: {
  paymentId: string;
  eventId: string | null;
  payload: unknown;
  reason: string;
}): Promise<void> {
  const payment = await db.selectFrom("payments").selectAll().where("id", "=", params.paymentId).executeTakeFirst();
  if (!payment || payment.status === "succeeded") return;
  await db
    .updateTable("payments")
    .set({ status: "failed", failure_reason: params.reason.slice(0, 400), updated_at: nowIso() })
    .where("id", "=", payment.id)
    .execute();
  await db
    .updateTable("orders")
    .set({ payment_status: "failed", updated_at: nowIso() })
    .where("id", "=", payment.order_id)
    .execute();
  await db
    .insertInto("payment_transactions")
    .values({
      id: ids.paymentTransaction(),
      payment_id: payment.id,
      type: "webhook",
      provider_event_id: params.eventId,
      amount: null,
      currency: null,
      status: "failed",
      payload_json: JSON.stringify(params.payload).slice(0, 20_000),
      note: params.reason.slice(0, 400),
      created_at: nowIso(),
    })
    .execute()
    .catch(() => undefined);
}

export async function markPaymentExpired(paymentId: string, payload: unknown = null): Promise<void> {
  const payment = await db.selectFrom("payments").selectAll().where("id", "=", paymentId).executeTakeFirst();
  if (!payment || payment.status === "succeeded") return;
  await db
    .updateTable("payments")
    .set({ status: "expired", updated_at: nowIso() })
    .where("id", "=", payment.id)
    .execute();
  await cancelOrder({
    orderId: payment.order_id,
    reason: "Payment expired",
    actorType: "system",
    actorId: null,
  });
  await db
    .insertInto("payment_transactions")
    .values({
      id: ids.paymentTransaction(),
      payment_id: payment.id,
      type: "webhook",
      provider_event_id: null,
      amount: null,
      currency: null,
      status: "expired",
      payload_json: JSON.stringify(payload).slice(0, 20_000),
      note: null,
      created_at: nowIso(),
    })
    .execute()
    .catch(() => undefined);
}

/** Customer submits a bank transfer slip — this only moves the order to "awaiting verification". */
export async function submitBankTransferProof(paymentId: string, reference: string): Promise<{ ok: boolean; error?: string }> {
  const payment = await db.selectFrom("payments").selectAll().where("id", "=", paymentId).executeTakeFirst();
  if (!payment) return { ok: false, error: "common.notFound" };
  if (payment.status === "succeeded") return { ok: true };
  if (payment.method !== "bank_transfer") return { ok: false, error: "error.paymentNotConfigured" };

  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable("payments")
      .set({ status: "awaiting_verification", updated_at: nowIso(), failure_reason: null })
      .where("id", "=", payment.id)
      .execute();
    await tx
      .updateTable("orders")
      .set({ payment_status: "awaiting_verification", status: "awaiting_verification", updated_at: nowIso() })
      .where("id", "=", payment.order_id)
      .where("status", "=", "pending_payment")
      .execute();
    await tx
      .insertInto("payment_transactions")
      .values({
        id: ids.paymentTransaction(),
        payment_id: payment.id,
        type: "verify",
        provider_event_id: null,
        amount: payment.amount,
        currency: payment.currency,
        status: "awaiting_verification",
        payload_json: null,
        note: `Customer reference: ${reference}`.slice(0, 400),
        created_at: nowIso(),
      })
      .execute();
  });

  await notifyAdmins("transfer_proof", {
    titleTh: "มีหลักฐานการโอนเงินใหม่",
    titleEn: "New transfer proof submitted",
    bodyTh: `กรุณาตรวจสอบยอด ${(payment.amount / 100).toLocaleString("th-TH")} บาท`,
    bodyEn: `Verify a transfer of THB ${(payment.amount / 100).toLocaleString("en-US")}`,
    linkUrl: `/th/admin/orders`,
  });
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                     */
/* -------------------------------------------------------------------------- */

export async function processRefund(params: {
  orderId: string;
  amount: number;
  reason: string;
  adminId: string;
  manual: boolean;
}): Promise<{ ok: boolean; error?: string; refundId?: string }> {
  const order = await db.selectFrom("orders").selectAll().where("id", "=", params.orderId).executeTakeFirst();
  if (!order) return { ok: false, error: "common.notFound" };
  const payment = await db
    .selectFrom("payments")
    .selectAll()
    .where("order_id", "=", order.id)
    .where("status", "in", ["succeeded", "partially_refunded"])
    .executeTakeFirst();
  if (!payment) return { ok: false, error: "error.paymentNotConfigured" };

  const remaining = payment.amount - order.refunded_total;
  const amount = Math.floor(params.amount);
  if (amount <= 0 || amount > remaining) return { ok: false, error: "validation.positive" };

  let providerRefundId: string | null = null;
  if (!params.manual) {
    const provider = getProvider(payment.provider);
    const result = await provider.refund({
      paymentId: payment.id,
      providerReference: payment.provider_reference,
      amount,
      currency: payment.currency,
      reason: params.reason,
    });
    if (!result.ok) return { ok: false, error: result.error ?? "refund_failed" };
    providerRefundId = result.providerRefundId;
  }

  const refundId = idFactory.refund();
  const now = nowIso();
  const newRefundedTotal = order.refunded_total + amount;
  const fullyRefunded = newRefundedTotal >= payment.amount;

  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto("refunds")
      .values({
        id: refundId,
        payment_id: payment.id,
        order_id: order.id,
        amount,
        reason: params.reason.slice(0, 400),
        status: "succeeded",
        provider_refund_id: providerRefundId,
        note: params.manual ? "Manual refund recorded by staff" : null,
        created_by: params.adminId,
        created_at: now,
        processed_at: now,
      })
      .execute();
    await tx
      .updateTable("payments")
      .set({ status: fullyRefunded ? "refunded" : "partially_refunded", updated_at: now })
      .where("id", "=", payment.id)
      .execute();
    await tx
      .updateTable("orders")
      .set({
        refunded_total: newRefundedTotal,
        payment_status: fullyRefunded ? "refunded" : "partially_refunded",
        status: fullyRefunded ? "refunded" : order.status,
        updated_at: now,
      })
      .where("id", "=", order.id)
      .execute();
    await tx
      .insertInto("order_events")
      .values({
        id: idFactory.orderEvent(),
        order_id: order.id,
        type: "refund",
        message: `Refund ${(amount / 100).toFixed(2)} THB — ${params.reason}`,
        from_status: order.status,
        to_status: fullyRefunded ? "refunded" : order.status,
        actor_type: "admin",
        actor_id: params.adminId,
        visible_to_customer: 1,
        created_at: now,
      })
      .execute();
    await tx
      .insertInto("payment_transactions")
      .values({
        id: ids.paymentTransaction(),
        payment_id: payment.id,
        type: "refund",
        provider_event_id: null,
        amount,
        currency: payment.currency,
        status: "succeeded",
        payload_json: null,
        note: params.reason.slice(0, 400),
        created_at: now,
      })
      .execute();
  });

  await sendRefundEmail({
    to: order.email,
    locale: order.locale as Locale,
    name: order.customer_name,
    orderNumber: order.order_number,
    amount,
  });
  return { ok: true, refundId };
}

/* -------------------------------------------------------------------------- */
/* Webhook entry point                                                         */
/* -------------------------------------------------------------------------- */

export async function applyPaymentWebhook(
  providerId: string,
  request: { rawBody: string; headers: Record<string, string>; query: Record<string, string> },
): Promise<{ ok: boolean; status: number; message: string; duplicate?: boolean }> {
  let provider;
  try {
    provider = getProvider(providerId);
  } catch {
    return { ok: false, status: 404, message: "unknown provider" };
  }

  let event: NormalizedEvent;
  try {
    event = await provider.parseWebhook(request, secretFor(providerId));
  } catch (error) {
    return { ok: false, status: 400, message: (error as Error).message };
  }

  const existing = await db
    .selectFrom("webhook_events")
    .select("id")
    .where("provider", "=", providerId)
    .where("event_id", "=", event.eventId)
    .executeTakeFirst();
  if (existing) return { ok: true, status: 200, message: "duplicate", duplicate: true };

  const inserted = await db
    .insertInto("webhook_events")
    .values({
      id: ids.webhook(),
      provider: providerId,
      event_id: event.eventId,
      event_type: event.type,
      payload_json: JSON.stringify(event.raw).slice(0, 40_000),
      status: "received",
      error: null,
      created_at: nowIso(),
      processed_at: null,
    })
    .returning("id")
    .executeTakeFirst()
    .catch(() => null);

  if (!inserted) return { ok: true, status: 200, message: "duplicate", duplicate: true };

  const payment = event.paymentId
    ? await db.selectFrom("payments").selectAll().where("id", "=", event.paymentId).executeTakeFirst()
    : event.providerReference
      ? await db.selectFrom("payments").selectAll().where("provider_reference", "=", event.providerReference).executeTakeFirst()
      : null;

  if (!payment) {
    await db
      .updateTable("webhook_events")
      .set({ status: "unmatched", error: "payment not found", processed_at: nowIso() })
      .where("id", "=", inserted.id)
      .execute();
    return { ok: false, status: 422, message: "payment not found" };
  }

  let result: { ok: boolean; error?: string } = { ok: true };
  try {
    if (event.type === "paid") {
      result = await markPaymentSucceeded({
        paymentId: payment.id,
        amount: event.amount,
        currency: event.currency,
        providerReference: event.providerReference,
        eventId: event.eventId,
        payload: event.raw,
        source: "webhook",
      });
    } else if (event.type === "failed") {
      await markPaymentFailed({
        paymentId: payment.id,
        eventId: event.eventId,
        payload: event.raw,
        reason: "provider_reported_failed",
      });
    } else if (event.type === "expired") {
      await markPaymentExpired(payment.id, event.raw);
    } else if (event.type === "refunded") {
      await db
        .insertInto("payment_transactions")
        .values({
          id: ids.paymentTransaction(),
          payment_id: payment.id,
          type: "refund",
          provider_event_id: event.eventId,
          amount: event.amount,
          currency: event.currency,
          status: "provider_refunded",
          payload_json: JSON.stringify(event.raw).slice(0, 20_000),
          note: null,
          created_at: nowIso(),
        })
        .execute()
        .catch(() => undefined);
    }
  } catch (error) {
    result = { ok: false, error: (error as Error).message };
  }

  await db
    .updateTable("webhook_events")
    .set({
      status: result.ok ? "processed" : "error",
      error: result.error ?? null,
      processed_at: nowIso(),
    })
    .where("id", "=", inserted.id)
    .execute();

  return {
    ok: result.ok,
    status: result.ok ? 200 : 422,
    message: result.error ?? "ok",
  };
}

/** Development-only helper used by the payment page and E2E script. */
export async function simulateSandboxPayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  if (env.isProduction) return { ok: false, error: "sandbox_disabled" };
  const payment = await db.selectFrom("payments").selectAll().where("id", "=", paymentId).executeTakeFirst();
  if (!payment) return { ok: false, error: "common.notFound" };
  if (payment.provider !== "sandbox") return { ok: false, error: "not_sandbox" };
  return markPaymentSucceeded({
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    providerReference: payment.provider_reference,
    eventId: `sandbox:${payment.id}:${Date.now()}`,
    payload: { simulated: true },
    source: "sandbox",
  });
}

export async function paymentMethodsForStore(): Promise<
  Array<{ id: PaymentMethod; labelKey: string; provider: string; available: boolean }>
> {
  const settings = await getSettings();
  const providerId = env.payments.provider;
  const provider = getProvider(providerId);
  const methods: Array<{ id: PaymentMethod; labelKey: string }> = [
    { id: "promptpay", labelKey: "checkout.payment.promptpay" },
    { id: "card", labelKey: "checkout.payment.card" },
    { id: "bank_transfer", labelKey: "checkout.payment.bank" },
    { id: "cod", labelKey: "checkout.payment.cod" },
  ];
  return methods
    .filter((method) => provider.supports.includes(method.id))
    .filter((method) => settings.payment.methods.includes(method.id) || method.id === "bank_transfer")
    .map((method) => ({
      ...method,
      provider: provider.id,
      available:
        method.id === "cod"
          ? settings.payment.codEnabled
          : provider.id === "sandbox"
            ? !env.isProduction
            : true,
    }));
}

export { parseJson };
