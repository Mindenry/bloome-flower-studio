# Troubleshooting

## Installation

### `better-sqlite3` fails to build / node-gyp error
This project does **not** use `better-sqlite3`. It uses Node's built-in `node:sqlite` through a custom Kysely dialect, so no native compilation is needed. If you see this error, an old lockfile is installed:

```bash
rm -rf node_modules package-lock.json && npm install
```

### `node:sqlite` is not available
You are on Node < 22.5. Upgrade Node, or use PostgreSQL for development (`DATABASE_URL=postgresql://…`).

### npm refuses to run install scripts for `sharp`
```bash
npm install-scripts approve sharp
```

### `sharp` throws `colourspace: parameter space not set` on upload
Two incompatible `sharp`/libvips builds are loaded in one process — usually a nested copy from Next.js. Ensure a single version:

```bash
npm ls sharp          # expect a single 0.35.5
npm dedupe
# restart the dev server afterwards
```

## Database

### `table cart_items has no column named unit_price_snapshot`
An old database was created before migration 002. Run:

```bash
npm run db:migrate
```

### `database is locked` (SQLite)
Close other processes using the file (Studio, DB browsers, a second dev server). The dialect sets `busy_timeout=10000` and WAL mode; long-running manual transactions are the usual cause.

### Reset local data
```bash
npm run db:reset && npm run db:setup
```
This deletes the SQLite file only — never run it against PostgreSQL (the script refuses).

### Postgres connection errors
- Confirm `DATABASE_URL` and `DATABASE_SSL` (managed providers usually need TLS).
- Check firewall/allow-list for the app server.
- Verify pooled connections do not exceed the provider limit; each app instance uses up to 10.

## Auth

### Everyone is redirected to `/th`
The middleware localises paths without a locale prefix and sets `bloome_locale`. If you embed the app under a sub-path, adjust `src/middleware.ts` and `APP_URL`.

### Login loop / session not persisted
- `APP_URL` must match the browser origin exactly.
- Secure cookies require HTTPS; behind a proxy ensure `X-Forwarded-Proto: https`.
- The user may be `disabled` or soft-deleted.

### `Too many attempts` on login/reset
Rate limits live in `rate_limits` (fixed window). Wait for the window, or clear for a specific key:

```sql
DELETE FROM rate_limits WHERE key LIKE 'login:%';
```

### LINE/Google login returns `?error=not_configured`
`LINE_CHANNEL_ID`/secret (or Google client id/secret) are missing. Add them to `.env.local` and restart.

### `?error=invalid_state`
State cookie missing/mismatched or expired (10 minutes). Restart the login flow from the login page; do not reuse a callback URL.

### `?linkRequired=1`
An account with the same email already exists but is not linked. Sign in with the existing account, then link the provider from **Account → Security** (ownership is verified).

## Checkout & orders

### Checkout refuses to load (`redirect /cart`)
The cart is empty or contains a blocking issue (product unpublished, variant disabled, insufficient stock). The cart page lists each line's problem.

### `This delivery window is full`
Capacity is enforced atomically. Pick another window, or raise capacity in **Admin → Settings → Delivery** (per-date capacity overrides are in the booked-capacity table).

### Orders expire too quickly
`payment.promptpayExpiryMinutes` (default 30) drives the payment window. The maintenance cron must run; without it, unpaid orders are not auto-cancelled until the next invocation.

### Prices differ between page and checkout
Prices are recalculated server-side at checkout. If the catalog changed while the cart was open, the cart shows “price changed” and the new price is used.

### Bank transfer proof does not mark the order paid
By design. It moves the payment to `awaiting_verification`; staff must confirm in **Admin → Orders → Verify payment**.

## Payments

### Webhook returns 400 `invalid_signature`
- Stripe: wrong `STRIPE_WEBHOOK_SECRET`, or the proxy modified the raw body. The route reads the body as text; ensure no middleware re-serialises JSON.
- Sandbox: sign with `AUTH_SECRET` and send `x-sandbox-signature`.

### Provider charge created but no QR shown
`qr_payload` can be a remote image URL. If it is null, the provider response changed or the account is not enabled for PromptPay. Check `payment_transactions.payload_json`.

### `error.paymentNotConfigured`
The selected method is not supported by the active `PAYMENT_PROVIDER`, or its credentials are missing. Check **Admin → Settings** badges (`READY` / `CONFIGURE`).

### Refund says “manual refund required”
`manual_bank_transfer` has no refund API. Transfer manually, then submit the refund form with **Manual refund** checked.

## Media

### Upload rejected
Max 8 MB, JPEG/PNG/WebP only, real content sniffed by sharp. SVG is rejected intentionally.

### Images 404 in production
`/uploads/...` only works with the local driver and a persistent volume. Switch to `STORAGE_DRIVER=s3` and set `S3_PUBLIC_URL`/CDN. Check bucket policy for public read.

### Images not refreshed after replacement
CDN cache. Upload under a new key (the app always generates random keys) or purge the CDN path.

## Email / LINE notifications

### Emails are not delivered
- In development `MAIL_DRIVER=log` records messages in `email_log` instead of sending.
- In production set `MAIL_HOST`/credentials; failures are recorded as `failed` with the error string.
- Check SPF/DKIM at your email provider.

### LINE messages not received
The customer must have linked LINE, and a **Messaging API** channel token (separate from LINE Login) must be configured. Marketing messages require consent.

## Build & runtime

### `next build` fails with ESLint errors
Run `npm run lint` and fix. Rules can be relaxed in `eslint.config.mjs`, but do not disable `no-html-link-for-pages` globally.

### Hydration or console warnings
Date formatting uses `Intl` with `Asia/Bangkok` on both server and client. If you add a client component that formats dates, render it after mount or pass a preformatted string.

### Admin pages overflow on tablets
`AdminTable` scrolls horizontally inside its container; add `min-w-0` to any new grid/flex ancestor you introduce in admin pages.

### Thai text becomes `?` after editing files with scripts
Windows PowerShell 5.1 defaults to ANSI. Always write UTF-8 (the project's file tools do), or use `Set-Content -Encoding UTF8`. Check with:

```bash
rg "\?\?\?\?" src
```

## Getting help

Collect: `GET /api/health`, the failing URL, relevant `activity_logs`/`email_log`/`webhook_events` rows, and server logs (never secrets). File an issue with reproduction steps.
