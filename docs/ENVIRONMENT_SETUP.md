# Environment setup

All variables are read through `src/lib/env.ts`. Never commit real secrets; `.env.local` is git-ignored.

## Core

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | production | `development` | Enables secure cookies, disables the sandbox provider, changes logging |
| `APP_URL` | yes | `http://localhost:3000` | Canonical origin used for OAuth callbacks, payment return URLs, emails and sitemap |
| `APP_NAME` | no | `BLOOMÉ FLOWER STUDIO` | Fallback brand name (store name is editable in Admin → Settings) |
| `AUTH_SECRET` | yes | dev placeholder | Session cookie tokens are hashed independently, but this secret signs order-access and sandbox webhooks. Use 32+ random bytes |
| `CRON_SECRET` | production | empty | Bearer secret for `/api/cron/maintenance` |
| `ADMIN_IP_ALLOWLIST` | no | empty | Comma-separated IPs; reserved for network-level restriction |

## Database

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `file:./data/bloome.db` | `file:` path (SQLite) or `postgresql://…` (production) |
| `DATABASE_SSL` | `false` | Enable TLS for managed Postgres |

Migrations are dialect-portable (`text`, `integer`, ISO-8601 timestamps, 0/1 booleans). Money is stored as integers in satang.

## Auth — LINE Login

| Variable | Description |
| --- | --- |
| `LINE_CHANNEL_ID` | LINE Login channel ID (not Messaging API) |
| `LINE_CHANNEL_SECRET` | Channel secret, server-side only |
| `LINE_CALLBACK_URL` | Must match the channel exactly, e.g. `https://bloome.studio/api/auth/line/callback` |
| `LINE_LOGIN_SCOPE` | Default `profile openid email` |

The app validates the OAuth `state` (cookie + DB), PKCE `code_verifier`, ID-token signature via LINE JWKS, `iss`, `aud`, `exp` and `nonce`. Never auto-links accounts by email. See [LINE_LOGIN_SETUP.md](./LINE_LOGIN_SETUP.md).

## Auth — Google

| Variable | Description |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web client ID |
| `GOOGLE_CLIENT_SECRET` | Client secret |
| `GOOGLE_CALLBACK_URL` | `https://your-domain/api/auth/google/callback` |

ID tokens are verified via Google JWKS with issuer/audience/nonce checks.

## Payments

| Variable | Description |
| --- | --- |
| `PAYMENT_PROVIDER` | `manual_bank_transfer` \| `promptpay_omise` \| `stripe` \| `sandbox` |
| `PAYMENT_CURRENCY` | `THB` |
| `OMISE_PUBLIC_KEY` / `OMISE_SECRET_KEY` | Opn Payments keys (PromptPay) |
| `OMISE_API_VERSION` | Default `2019-05-29` |
| `OMISE_WEBHOOK_KEY` | Optional shared key appended to the webhook URL |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Stripe keys |
| `STRIPE_WEBHOOK_SECRET` | Required for Stripe signature verification |
| `BANK_ACCOUNT_NAME` / `BANK_ACCOUNT_NUMBER` / `BANK_NAME` / `BANK_BRANCH` | Manual transfer instructions (shown at checkout; overrides admin settings) |

`sandbox` is development-only and refuses to run when `NODE_ENV=production`. See [PAYMENT_SETUP.md](./PAYMENT_SETUP.md).

## Email

| Variable | Description |
| --- | --- |
| `MAIL_DRIVER` | `smtp` or `log` |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE` | SMTP endpoint (`587` + STARTTLS typical) |
| `MAIL_USER`, `MAIL_PASS` | SMTP credentials |
| `MAIL_FROM` | From header, e.g. `BLOOMÉ <hello@domain>` |
| `MAIL_REPLY_TO` | Optional reply-to |

With `MAIL_DRIVER=log` (or smtp without a host in non-production) every message is recorded in `email_log` instead of being sent — useful for local development and automated tests. In production, configure SMTP; failures are logged with status `failed`.

## LINE Messaging API (notifications)

| Variable | Description |
| --- | --- |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Messaging API channel token (separate from LINE Login) |
| `LINE_MESSAGING_CHANNEL_SECRET` | Messaging channel secret |
| `LINE_OA_ADD_FRIEND_URL` | Optional add-friend link |

Messages are only pushed to customers who linked LINE and only for transactional events. Marketing broadcasts require marketing consent.

## Storage

| Variable | Description |
| --- | --- |
| `STORAGE_DRIVER` | `local` or `s3` |
| `UPLOAD_DIR` | Local directory (default `./public/uploads`) |
| `PUBLIC_UPLOAD_PREFIX` | URL prefix for local files (default `/uploads`) |
| `S3_BUCKET`, `S3_REGION` | Bucket and region |
| `S3_ENDPOINT` | Custom endpoint for R2/MinIO (enables path-style) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credentials |
| `S3_PUBLIC_URL` | CDN/base URL used to build public image URLs |

See [STORAGE_SETUP.md](./STORAGE_SETUP.md).

## Seed / bootstrap

| Variable | Description |
| --- | --- |
| `SEED_ADMIN_EMAIL` | Super admin email created by `npm run db:seed` |
| `SEED_ADMIN_PASSWORD` | Initial password — change after first login |
| `SEED_DEMO_DATA` | `true` inserts a demo delivered order + two verified reviews |

## Setting reference

Store settings (name, contact details, delivery rules, VAT, payment methods, SEO copy) are stored in the `store_settings` table and editable at **Admin → Settings**. Environment values for bank details override the database so banking information never needs to live in the admin UI.
