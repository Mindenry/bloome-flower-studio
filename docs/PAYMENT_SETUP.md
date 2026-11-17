# Payment setup

The platform talks to payment providers through a small adapter interface (`src/lib/payments/types.ts`), so business logic (orders, stock, notifications) never depends on a specific gateway.

| Provider id | Methods | Status |
| --- | --- | --- |
| `manual_bank_transfer` | Bank transfer, cash on delivery (optional) | Tested end-to-end (order → staff verification → paid) |
| `sandbox` | PromptPay/card/bank (development only) | Tested end-to-end including signed webhooks |
| `promptpay_omise` (Opn Payments) | PromptPay QR | Implemented — **READY FOR CONFIGURATION** |
| `stripe` | Cards (Checkout), PromptPay | Implemented — **READY FOR CONFIGURATION** |

Only one provider is active at a time via `PAYMENT_PROVIDER`. The checkout UI lists only methods that provider supports and that are enabled in **Admin → Settings → Payment**.

## Rules enforced by the code

- A QR code or redirect is **never** proof of payment. Orders become paid only when a verified webhook (or a staff verification for manual transfer) confirms amount and currency.
- The amount is always taken from the server-side order, never from the client or the webhook body.
- Webhooks are idempotent: `(provider, event_id)` is unique, and `payment_transactions.provider_event_id` prevents duplicate postings.
- Signature verification:
  - Stripe: `stripe-signature` HMAC-SHA256 over `timestamp.body`, 5-minute tolerance.
  - Omise: no signed webhooks — the route re-fetches the charge from the API and matches metadata (`payment_id`, `order_id`) plus amount/currency. Optionally require `?key=OMISE_WEBHOOK_KEY`.
  - Sandbox: HMAC-SHA256 with `AUTH_SECRET`.
- Payment state machine: `pending → processing → succeeded | failed | expired | cancelled`, `succeeded → partially_refunded → refunded`. Invalid transitions are rejected.
- Unpaid orders expire: the maintenance job cancels them, restores stock and frees delivery capacity (`POST /api/cron/maintenance`).

## Manual bank transfer

```env
PAYMENT_PROVIDER=manual_bank_transfer
BANK_NAME=Kasikorn Bank
BANK_ACCOUNT_NAME=BLOOMÉ FLOWER STUDIO CO., LTD.
BANK_ACCOUNT_NUMBER=000-0-00000-0
```

Flow: customer places the order → sees bank details and the order number → submits a transfer reference → payment becomes `awaiting_verification` (order `awaiting_verification`) → staff open **Admin → Orders → Verify payment** → payment `succeeded`, order `paid`. Uploading a slip/reference never marks an order paid automatically.

## PromptPay via Opn Payments (Omise)

```env
PAYMENT_PROVIDER=promptpay_omise
OMISE_PUBLIC_KEY=pkey_test_…
OMISE_SECRET_KEY=skey_test_…
OMISE_API_VERSION=2019-05-29
OMISE_WEBHOOK_KEY=<optional shared secret>
```

Implementation: `POST /sources` (`type=promptpay`) → `POST /charges` with metadata (`payment_id`, `order_id`, `order_number`) → the QR image URL is stored as `payments.qr_payload`.

In the Opn dashboard, configure the webhook URL:

```
https://your-domain.com/api/webhooks/payments/promptpay_omise?key=<OMISE_WEBHOOK_KEY>
```

Events are not trusted directly; the handler calls `GET /charges/{id}` and uses the API response.

## Stripe (cards and PromptPay)

```env
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_…
STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

- PromptPay: PaymentIntent with `payment_method_types[]=promptpay`; the returned `promptpay_display_qr_code` is shown.
- Cards: Checkout Session (`mode=payment`, `payment_method_types[]=card`), redirecting to the hosted page.
- Webhook endpoint: `https://your-domain.com/api/webhooks/payments/stripe`, subscribed to `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `checkout.session.completed`, `charge.refunded`.

Test with Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/payments/stripe
```

## Sandbox (development only)

```env
PAYMENT_PROVIDER=sandbox
```

Generates a fake reference/QR and accepts a signed webhook. It throws if `NODE_ENV=production`. Use it for demos and automated tests — never in production.

## Refunds

- Provider refunds use the adapter (`POST /v1/refunds`, `POST /charges/{id}/refund`).
- If the provider does not support API refunds (manual bank transfer), the admin form offers **Manual refund**: the staff member transfers the money and records the refund; statuses and the customer email are still updated.
- Partial refunds are supported; `payments.status` becomes `partially_refunded`, then `refunded` once fully refunded. Every refund is stored with reason, amount, provider reference and actor.

## Sandbox / integration test matrix

| Scenario | Expected result |
| --- | --- |
| Successful payment | Order `paid`, payment `succeeded`, sold counters incremented, email + notification |
| Failed payment | Payment `failed`, order stays unpaid |
| Expired payment | Payment `expired`, order cancelled, stock and slot restored |
| Duplicate webhook | `duplicate`, no double posting |
| Invalid signature | HTTP 400, nothing changes |
| Wrong amount | HTTP 422/mismatch recorded, order not paid |
| Refund | `refunds` row, payment `partially_refunded`/`refunded`, email |

All of the above are covered by `npm run e2e` (sandbox + manual paths).
