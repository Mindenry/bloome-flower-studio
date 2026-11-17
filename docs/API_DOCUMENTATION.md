# API documentation

Two API surfaces exist:

1. **Route handlers** under `src/app/api/**` (REST, JSON, used by client widgets, webhooks, auth callbacks and operations).
2. **Server Actions** under `src/app/actions/**` (typed mutations called by forms; validated with Zod, authorised in the action, then revalidated).

All mutations are authorised server-side. The UI never sends prices, discounts or payment status.

## Response conventions (route handlers)

```json
{ "error": "validation.required" }
{ "ok": true, "message": "…" }
{ "image": { "id": "upl_…", "url": "/uploads/products/2026/11/x.webp", "width": 900, "height": 1180 } }
```

Errors use stable machine codes; the UI maps them to Thai/English dictionary keys. HTTP statuses: 400 validation/signature, 401 unauthenticated, 403 forbidden, 404 unknown, 405 wrong method, 413 too large, 422 business rejection, 429 rate limited, 500 unexpected.

---

## Public routes

### `GET /api/health`
Returns `{ status, time, schema, environment, paymentProvider }`; `503` if the database is unreachable.

### `GET /api/search/suggest?q=&locale=`
Autocomplete for the header search. Rate limited 120/min/IP. Returns `products[5]`, matching `categories`, and `popular` search terms (derived from paid order items).

### `GET /api/finder?occasion=&budget=min-max&color=&type=&locale=`
Flower Finder recommendations. `budget` is in THB major units (`1500-2500`). Returns up to 12 in-stock products and `exact: false` when a relaxed fallback was used.

---

## Auth routes

### `GET /api/auth/{line|google}/start?next=/th/account&locale=th`
Creates a single-use OAuth state (+ nonce + PKCE verifier) in `oauth_states`, sets the `bloome_oauth_state` cookie, redirects to the provider.

### `GET /api/auth/{line|google}/start?link=1`
Requires an authenticated session; links the provider to the current account after the callback.

### `GET /api/auth/{line|google}/callback`
Validates state cookie + DB record, exchanges the code, verifies the ID token (JWKS, issuer, audience, nonce), resolves or creates the customer, creates a session and redirects. Surfaces failures as `?error=` codes on the login page. Never auto-links by email.

---

## Payment webhooks

### `POST /api/webhooks/payments/{provider}`

| Provider | Verification |
| --- | --- |
| `stripe` | `stripe-signature` HMAC over `t.body` with `STRIPE_WEBHOOK_SECRET`, 5-minute tolerance |
| `promptpay_omise` | Shared key (`?key=`) when configured **and** the charge is re-fetched from the Omise API — body is never trusted |
| `sandbox` | `x-sandbox-signature` HMAC with `AUTH_SECRET` (development only) |
| `manual_bank_transfer` | No webhook; staff verification through the admin portal |

Behaviour:
- Raw body is read as text (signatures require exact bytes).
- Each event is stored in `webhook_events` with a unique `(provider, event_id)`; duplicates return `{ ok: true, message: "duplicate" }`.
- Amount and currency must match the payment; mismatches are recorded and never mark the order paid.
- Successful payment updates `payments.status`, `orders.payment_status`, `orders.status=paid`, `paid_at`, `sold_count`, inserts a transaction, then sends email/in-app/LINE notifications.

### `GET|POST /api/cron/maintenance?key=CRON_SECRET`
Expires unpaid orders (restocking + releasing capacity), purges sessions and rate limits, marks abandoned carts. Call every 5 minutes from a scheduler. Supports `x-cron-secret` header.

---

## Admin routes

### `POST /api/uploads`
Multipart `file` + optional `prefix`. Requires `products.update` or `content.manage`. Validates real image bytes with sharp, rejects > 8 MB or unsupported formats, re-encodes to WebP (max 2000 px, EXIF stripped), stores via the storage adapter and returns metadata. Rate limited 60/hour/user.

### `GET /api/admin/export?type=orders|products|customers&from=&to=`
UTF-8 CSV with BOM (Excel-friendly). Requires `orders.export`, `products.view` or `customers.view`. Every export is written to `activity_logs`.

---

## Server Actions

| File | Actions |
| --- | --- |
| `actions/auth.ts` | login, register, logout, forgot/reset password, resend verification, confirm email |
| `actions/cart.ts` | add (and buy-now), update quantity, remove, apply/remove coupon, toggle wishlist |
| `actions/checkout.ts` | `placeOrderAction` — validates, creates order transactionally, initiates payment, redirects |
| `actions/order.ts` | submit transfer proof, sandbox simulate, cancel, request refund, track order |
| `actions/account.ts` | profile, password, sessions, delete account, addresses, recipients, reminders, notifications, wishlist, provider unlinking, review submission |
| `actions/admin-products.ts` | save product (create/update + translations + images), archive/restore, publish toggle, duplicate, hard delete, variants, stock adjustments, bulk actions |
| `actions/admin-orders.ts` | status transitions, verify payment, notes, tracking, refunds |
| `actions/admin-categories.ts` | create/update/delete categories with translations |
| `actions/admin-marketing.ts` | coupons, review moderation/replies, broadcasts, admin notification read |
| `actions/admin-content.ts` | banners, pages, FAQs, gallery, blog posts |
| `actions/admin-staff.ts` | staff creation, role changes, disable/enable, role permissions |
| `actions/admin-settings.ts` | store/commerce/delivery/payment/SEO settings, slot templates, blocked dates, capacity |
| `actions/newsletter.ts` | subscribe + confirm token |
| `actions/contact.ts` | contact form → studio inbox |

All Server Actions:
- parse `FormData` with Zod (`src/lib/schemas.ts`),
- check the session and RBAC permission (`src/lib/auth/rbac.ts`),
- return `{ ok, error, message, fieldErrors, redirectTo }` (`FormState`) for `useActionState`,
- write an audit entry for privileged changes,
- call `revalidatePath` for affected surfaces.

## Price and stock authority

The client sends only product/variant/add-on identifiers and quantities. `placeOrder` reloads products, variants and add-ons from the database, recomputes unit prices, discounts, shipping, VAT and the grand total, checks stock and delivery capacity, decrements inventory, records coupon usage and writes the order inside one transaction. Replaying the same `idempotencyKey` returns the original order without side effects.
