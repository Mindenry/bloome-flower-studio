import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type {
  ChargeInput,
  ChargeResult,
  NormalizedEvent,
  PaymentMethod,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookRequest,
} from "./types";

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function requireMethod(method: PaymentMethod, supported: PaymentMethod[]): void {
  if (!supported.includes(method)) {
    throw new Error(`method_not_supported:${method}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Manual bank transfer / cash on delivery                                     */
/* -------------------------------------------------------------------------- */

export const manualProvider: PaymentProvider = {
  id: "manual_bank_transfer",
  label: "Manual bank transfer",
  supports: ["bank_transfer", "cod"],
  requiresRedirect: false,
  manualRefund: true,
  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    requireMethod(input.method, this.supports);
    return {
      providerReference: `MANUAL-${input.orderNumber}`,
      qrPayload: null,
      checkoutUrl: null,
      expiresAt: input.expiresAt,
      raw: { method: input.method, bankAccount: env.payments.bank.accountNumber || null },
    };
  },
  async parseWebhook(): Promise<NormalizedEvent> {
    throw new Error("manual_provider_has_no_webhook");
  },
  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      ok: false,
      providerRefundId: null,
      error: `manual_refund_required:${input.amount}`,
    };
  },
};

/* -------------------------------------------------------------------------- */
/* Sandbox — development only, never enabled in production                     */
/* -------------------------------------------------------------------------- */

export const sandboxProvider: PaymentProvider = {
  id: "sandbox",
  label: "Sandbox (development only)",
  supports: ["promptpay", "card", "bank_transfer"],
  requiresRedirect: false,
  manualRefund: false,
  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    if (env.isProduction) throw new Error("sandbox_provider_forbidden_in_production");
    requireMethod(input.method, this.supports);
    return {
      providerReference: `TEST-${input.orderNumber}`,
      qrPayload: `SANDBOX|${input.orderNumber}|${input.amount}`,
      checkoutUrl: null,
      expiresAt: input.expiresAt,
      raw: { sandbox: true },
    };
  },
  async parseWebhook(request: WebhookRequest, secret: string): Promise<NormalizedEvent> {
    if (env.isProduction) throw new Error("sandbox_provider_forbidden_in_production");
    const signature = request.headers["x-sandbox-signature"] ?? "";
    const expected = hmacHex(secret, request.rawBody);
    if (!signature || !safeEqual(signature, expected)) throw new Error("invalid_signature");
    const body = JSON.parse(request.rawBody) as {
      id?: string;
      type?: string;
      paymentId?: string;
      providerReference?: string;
      amount?: number;
      currency?: string;
    };
    if (!body.id) throw new Error("invalid_payload");
    return {
      eventId: body.id,
      type: body.type === "paid" ? "paid" : body.type === "failed" ? "failed" : "ignored",
      providerReference: body.providerReference ?? null,
      paymentId: body.paymentId ?? null,
      orderId: null,
      amount: body.amount ?? null,
      currency: body.currency ?? "THB",
      raw: body,
    };
  },
  async refund(input: RefundInput): Promise<RefundResult> {
    return { ok: true, providerRefundId: `TESTREF-${input.paymentId}`, error: null };
  },
};

/* -------------------------------------------------------------------------- */
/* Stripe — cards + PromptPay                                                  */
/* -------------------------------------------------------------------------- */

async function stripeRequest(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.payments.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-12-18.acacia",
    },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
  const json = (await response.json()) as Record<string, unknown> & {
    error?: { message?: string; code?: string };
  };
  if (!response.ok) {
    throw new Error(`stripe_error:${json.error?.code ?? response.status}:${json.error?.message ?? ""}`);
  }
  return json;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Stripe",
  supports: ["promptpay", "card"],
  requiresRedirect: true,
  manualRefund: false,

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    requireMethod(input.method, this.supports);
    if (!env.payments.stripeSecretKey) throw new Error("stripe_not_configured");

    if (input.method === "promptpay") {
      const intent = await stripeRequest("/payment_intents", {
        amount: String(input.amount),
        currency: input.currency.toLowerCase(),
        "payment_method_types[0]": "promptpay",
        description: input.description,
        "receipt_email": input.customer.email,
        "metadata[order_id]": input.orderId,
        "metadata[payment_id]": input.paymentId,
        "metadata[order_number]": input.orderNumber,
      });
      const nextAction = intent.next_action as
        | { promptpay_display_qr_code?: { image_url_png?: string; hosted_voucher_url?: string; expires_at?: number } }
        | null;
      const qr = nextAction?.promptpay_display_qr_code;
      return {
        providerReference: String(intent.id),
        qrPayload: qr?.image_url_png ?? null,
        checkoutUrl: qr?.hosted_voucher_url ?? null,
        expiresAt: qr?.expires_at ? new Date(qr.expires_at * 1000).toISOString() : input.expiresAt,
        raw: { id: intent.id, status: intent.status },
      };
    }

    const session = await stripeRequest("/checkout/sessions", {
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": input.description,
      "line_items[0][price_data][unit_amount]": String(input.amount),
      "line_items[0][quantity]": "1",
      customer_email: input.customer.email,
      client_reference_id: input.paymentId,
      success_url: `${input.returnUrl}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.returnUrl}?status=cancelled`,
      "metadata[order_id]": input.orderId,
      "metadata[payment_id]": input.paymentId,
      expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
    });

    return {
      providerReference: String(session.payment_intent ?? session.id),
      qrPayload: null,
      checkoutUrl: typeof session.url === "string" ? session.url : null,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      raw: { id: session.id },
    };
  },

  async parseWebhook(request: WebhookRequest, secret: string): Promise<NormalizedEvent> {
    const header = request.headers["stripe-signature"] ?? "";
    const parts = Object.fromEntries(
      header.split(",").map((part) => {
        const [key, value] = part.split("=");
        return [key?.trim() ?? "", value?.trim() ?? ""];
      }),
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) throw new Error("invalid_signature");
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("signature_expired");
    const expected = hmacHex(secret, `${timestamp}.${request.rawBody}`);
    if (!safeEqual(signature, expected)) throw new Error("invalid_signature");

    const event = JSON.parse(request.rawBody) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    const object = event.data?.object ?? {};
    const metadata = (object.metadata as Record<string, string> | undefined) ?? {};

    const base = {
      eventId: event.id,
      providerReference: null as string | null,
      paymentId: metadata.payment_id ?? null,
      orderId: metadata.order_id ?? null,
      amount: null as number | null,
      currency: null as string | null,
      raw: event,
    };

    switch (event.type) {
      case "payment_intent.succeeded":
        return {
          ...base,
          type: "paid",
          providerReference: String(object.id),
          amount: typeof object.amount_received === "number" ? object.amount_received : Number(object.amount ?? 0),
          currency: String(object.currency ?? "").toUpperCase(),
        };
      case "payment_intent.payment_failed":
        return {
          ...base,
          type: "failed",
          providerReference: String(object.id),
          amount: Number(object.amount ?? 0),
          currency: String(object.currency ?? "").toUpperCase(),
        };
      case "payment_intent.canceled":
        return {
          ...base,
          type: "expired",
          providerReference: String(object.id),
          amount: Number(object.amount ?? 0),
          currency: String(object.currency ?? "").toUpperCase(),
        };
      case "checkout.session.completed":
        return {
          ...base,
          type: "paid",
          providerReference: String(object.payment_intent ?? object.id),
          amount: typeof object.amount_total === "number" ? object.amount_total : null,
          currency: String(object.currency ?? "").toUpperCase(),
        };
      case "charge.refunded":
        return {
          ...base,
          type: "refunded",
          providerReference: String(object.payment_intent ?? object.id),
          amount: Number(object.amount_refunded ?? 0),
          currency: String(object.currency ?? "").toUpperCase(),
        };
      default:
        return { ...base, type: "ignored" };
    }
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!input.providerReference) return { ok: false, providerRefundId: null, error: "missing_reference" };
    try {
      const refund = await stripeRequest("/refunds", {
        payment_intent: input.providerReference,
        amount: String(input.amount),
        reason: "requested_by_customer",
        "metadata[reason]": input.reason,
      });
      return { ok: true, providerRefundId: String(refund.id), error: null };
    } catch (error) {
      return { ok: false, providerRefundId: null, error: (error as Error).message };
    }
  },
};

/* -------------------------------------------------------------------------- */
/* Opn Payments (Omise) — PromptPay QR                                         */
/* -------------------------------------------------------------------------- */

async function omiseRequest(path: string, body?: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.omise.co${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.payments.omiseSecretKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Omise-Version": env.payments.omiseApiVersion,
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
    cache: "no-store",
  });
  const json = (await response.json()) as Record<string, unknown> & {
    message?: string;
    code?: string;
  };
  if (!response.ok) throw new Error(`omise_error:${json.code ?? response.status}:${json.message ?? ""}`);
  return json;
}

type OmiseCharge = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: { payment_id?: string; order_id?: string };
  source?: { scannable_code?: { image?: { download_uri?: string } } };
  authorize_uri?: string;
};

export const omiseProvider: PaymentProvider = {
  id: "promptpay_omise",
  label: "Opn Payments (PromptPay)",
  supports: ["promptpay"],
  requiresRedirect: false,
  manualRefund: false,

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    requireMethod(input.method, this.supports);
    if (!env.payments.omiseSecretKey) throw new Error("omise_not_configured");

    const source = await omiseRequest("/sources", {
      amount: String(input.amount),
      currency: input.currency.toLowerCase(),
      type: "promptpay",
    });

    const charge = (await omiseRequest("/charges", {
      amount: String(input.amount),
      currency: input.currency.toLowerCase(),
      source: String(source.id),
      return_uri: input.returnUrl,
      description: input.description,
      "metadata[order_id]": input.orderId,
      "metadata[payment_id]": input.paymentId,
      "metadata[order_number]": input.orderNumber,
    })) as unknown as OmiseCharge;

    return {
      providerReference: charge.id,
      qrPayload: charge.source?.scannable_code?.image?.download_uri ?? null,
      checkoutUrl: charge.authorize_uri ?? null,
      expiresAt: input.expiresAt,
      raw: { id: charge.id, status: charge.status },
    };
  },

  async parseWebhook(request: WebhookRequest, secret: string): Promise<NormalizedEvent> {
    if (secret && request.query.key !== secret) throw new Error("invalid_webhook_key");
    const body = JSON.parse(request.rawBody) as {
      key?: string;
      data?: { id?: string };
    };
    const chargeId = body.data?.id;
    if (!chargeId) throw new Error("invalid_payload");

    // Never trust the webhook body: re-fetch the charge from the API.
    const charge = (await omiseRequest(`/charges/${chargeId}`)) as unknown as OmiseCharge;
    const type: NormalizedEvent["type"] =
      charge.status === "successful"
        ? "paid"
        : charge.status === "failed"
          ? "failed"
          : charge.status === "expired"
            ? "expired"
            : charge.status === "reversed"
              ? "refunded"
              : "ignored";

    return {
      eventId: `omise:${charge.id}:${charge.status}`,
      type,
      providerReference: charge.id,
      paymentId: charge.metadata?.payment_id ?? null,
      orderId: charge.metadata?.order_id ?? null,
      amount: charge.amount,
      currency: charge.currency?.toUpperCase() ?? null,
      raw: charge,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!input.providerReference) return { ok: false, providerRefundId: null, error: "missing_reference" };
    try {
      const refund = await omiseRequest(`/charges/${input.providerReference}/refund`, {
        amount: String(input.amount),
      });
      return { ok: true, providerRefundId: String(refund.id ?? ""), error: null };
    } catch (error) {
      return { ok: false, providerRefundId: null, error: (error as Error).message };
    }
  },
};

export const PROVIDERS: Record<string, PaymentProvider> = {
  manual_bank_transfer: manualProvider,
  sandbox: sandboxProvider,
  stripe: stripeProvider,
  promptpay_omise: omiseProvider,
};

export function getProvider(id: string = env.payments.provider): PaymentProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`unknown_payment_provider:${id}`);
  return provider;
}
