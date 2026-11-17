# BLOOMÉ FLOWER STUDIO

[![CI](https://github.com/Mindenry/bloome-flower-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Mindenry/bloome-flower-studio/actions/workflows/ci.yml)

A production-oriented, full-stack flower boutique platform: bilingual storefront (Thai / English), customer accounts, transactional checkout with delivery scheduling and inventory, provider-agnostic payments, and a complete admin portal with RBAC.

> **Flowers that speak what words cannot.**

---

## What is included

| Area | Status |
| --- | --- |
| Public storefront (home, shop, category, occasion, product, search, wishlist, cart) | Implemented — instant filters, occasion mapping |
| Checkout (contact → address → delivery slot → gift card → payment → review) | Implemented, transactional |
| Inventory with stock reservations, movements, batches, freshness & waste | Implemented |
| Payments: PromptPay (Opn/Omise), cards + PromptPay (Stripe), bank transfer, sandbox | Adapters implemented — **READY FOR CONFIGURATION** |
| Webhook verification, idempotency, refunds, payment state machine | Implemented |
| Auth: email/password + LINE Login + Google, sessions, password reset, email verification | Implemented — LINE/Google **READY FOR CONFIGURATION** |
| Customer portal (orders, tracking, addresses, recipients, reminders, wishlist, notifications, security/PDPA) | Implemented |
| Admin portal (dashboard, products, categories, inventory, orders, customers, coupons, reviews, CMS, blog, notifications, reports, staff, roles, activity, settings) | Implemented |
| i18n TH/EN with `/th` and `/en` prefixes, hreflang, canonical | Implemented |
| SEO: metadata, OG/Twitter, JSON-LD, sitemap, robots | Implemented |
| Flower Finder, gift message, occasion reminders, reviews (verified purchase only) | Implemented |
| Automated tests | 26 unit/integration assertions + 42 commerce E2E checks + 30 HTTP smoke checks |

Full status and next steps: [`PROJECT_PROGRESS.md`](./PROJECT_PROGRESS.md). Test evidence: [`docs/TESTING_REPORT.md`](./docs/TESTING_REPORT.md).

## Tech stack

- **Next.js 15.5** (App Router, React 19, Server Components, Server Actions)
- **TypeScript** strict mode
- **Kysely** query builder with two dialects: `node:sqlite` (development, zero native build) and **PostgreSQL** (production)
- **Tailwind CSS v4** design tokens
- **Zod** validation, **bcryptjs** hashing, **jose** for OIDC ID-token verification
- **sharp** for server-side image validation, re-encoding and compression
- **nodemailer** for transactional email, **LINE Messaging API** for push messages
- **S3-compatible** object storage adapter (AWS SDK) + local disk for development

No mock business logic: every price, discount, stock level and payment status is computed and verified server-side.

## Quick start

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run db:setup               # migrate + seed demo catalog & settings
npm run dev                    # http://localhost:3000
```

Seeded accounts (change immediately outside local development):

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@bloome.local` | `ChangeMe!2026` |
| Admin (operations) | `manager@bloome.local` | `Manager!2026` |
| Customer | `customer@bloome.local` | `Customer!2026` |

The seed creates an illustrative catalog, bilingual content, coupons, delivery windows, a delivered demo order and two reviews (`SEED_DEMO_DATA=true`). Set `SEED_DEMO_DATA=false` and change `SEED_ADMIN_*` before a production seed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit + schema + i18n parity tests |
| `npm run e2e` | Commerce integration test on an isolated SQLite DB |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Idempotent seed |
| `node scripts/smoke.mjs [url]` | HTTP smoke test against a running server |
| `npm run db:reset` | Delete the local SQLite database (dev only) |

## Project layout

```
src/
  app/
    [locale]/(store)/...      public + customer routes
    [locale]/admin/...        admin portal (own layout & guards)
    api/...                   webhooks, auth callbacks, uploads, search, cron
  components/                 design system + feature components
  lib/
    db/                       Kysely dialect, schema types, migrations
    auth/                     sessions, RBAC, OAuth, password
    payments/                 provider adapters + state machine
    ...                       pricing, cart, checkout, delivery, catalog, CMS
prisma-free, migration-driven schema in src/lib/db/migrations.ts
scripts/                      migrate/seed/reset/e2e/smoke
docs/                         operational and technical documentation
```

## Documentation

- [Installation](docs/INSTALLATION.md)
- [Environment setup](docs/ENVIRONMENT_SETUP.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [API documentation](docs/API_DOCUMENTATION.md)
- [LINE Login setup](docs/LINE_LOGIN_SETUP.md)
- [Payment setup](docs/PAYMENT_SETUP.md)
- [Storage setup](docs/STORAGE_SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Admin guide (TH/EN)](docs/ADMIN_GUIDE.md)
- [Testing report](docs/TESTING_REPORT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Photography

The development seed ships with **real flower photography** (optimised WebP, ~15 MB) sourced from Pexels
(free commercial licence) — 27 products, all categories, occasions, banners,
journal covers and the gallery. Each image is recorded with its original photo
link on `/{locale}/photo-credits`. Replace them with the studio's own
photography through **Admin → Products → Images** (or the content library)
when available.

Refresh or extend the demo photo set with (writes to public/images/demo):

```bash
node scripts/fetch-pexels.mjs   # downloads the curated Pexels IDs and writes public/photo-credits.json
npm run db:seed                 # re-applies the image mapping and content
```

## Production readiness caveats

- Only SQLite has been exercised in this environment. The Postgres dialect is wired and the schema is portable, but run the migration + smoke suite against your Postgres instance before launch.
- LINE Login, Google Login, Stripe/Omise and S3 require credentials and are marked **READY FOR CONFIGURATION** until verified with the live providers.
- Replace seeded demo imagery/content with studio photography and real policies before launch.
- Card data never touches this application; use the payment provider's hosted or QR flows.

## License

Proprietary — © BLOOMÉ FLOWER STUDIO. All rights reserved.
