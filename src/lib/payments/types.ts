/** Provider-agnostic payment contracts. Business logic only sees these types. */

export type PaymentMethod = "promptpay" | "card" | "bank_transfer" | "cod";

export type ChargeInput = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number; // minor units
  currency: string;
  method: PaymentMethod;
  customer: { name: string; email: string; phone: string };
  description: string;
  returnUrl: string;
  webhookUrl: string;
  expiresAt: string | null;
};

export type ChargeResult = {
  providerReference: string;
  qrPayload: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  raw: unknown;
};

export type WebhookRequest = {
  rawBody: string;
  headers: Record<string, string>;
  query: Record<string, string>;
};

/** `eventId` must be provider-unique: it is the webhook idempotency key. */
export type NormalizedEvent = {
  eventId: string;
  type: "paid" | "failed" | "expired" | "refunded" | "ignored";
  providerReference: string | null;
  paymentId: string | null;
  orderId: string | null;
  amount: number | null;
  currency: string | null;
  raw: unknown;
};

export type RefundInput = {
  paymentId: string;
  providerReference: string | null;
  amount: number;
  currency: string;
  reason: string;
};

export type RefundResult = { ok: boolean; providerRefundId: string | null; error: string | null };

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  readonly supports: PaymentMethod[];
  readonly requiresRedirect: boolean;
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  parseWebhook(request: WebhookRequest, secret: string): Promise<NormalizedEvent>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** A manual provider cannot refund through an API — the admin marks it manually. */
  readonly manualRefund: boolean;
}
