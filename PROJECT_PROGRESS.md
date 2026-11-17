# Project progress

**Product:** BLOOMÉ FLOWER STUDIO — bilingual premium flower e-commerce platform
**Last updated:** 18 November 2026

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Repository audit (empty directory, Node 26, no Docker/PostgreSQL) | Complete |
| 1 | Architecture, portable schema, API contract, auth/payment strategy, design tokens | Complete |
| 2 | Project setup, database, migrations, sessions, RBAC, error handling, shared UI, i18n | Complete |
| 3 | Storefront: home, shop, category, occasion, product, search, cart, wishlist | Complete |
| 4 | Checkout, orders, inventory, delivery scheduling, coupons, price engine | Complete |
| 5 | LINE/Google OAuth, payment adapters, webhooks, email, LINE messaging, storage | Complete — external providers **READY FOR CONFIGURATION** |
| 6 | Admin portal: dashboard, catalog, inventory, orders, customers, coupons, reviews, CMS, blog, notifications, reports, staff, roles, activity, settings | Complete |
| 7 | Flower Finder, gift message, occasion reminders, reviews, blog, analytics | Complete |
| 7b | Real photography pass (Pexels, 191 credits), premium header (shrink-on-scroll, mega menu, ⌘K search, account menu, mobile drawer), instant filters, larger newsletter | Complete |
| 8 | Unit/integration tests, HTTP smoke, browser walkthrough, responsive audit, hardening | Complete |
| 9 | Production build + runbook + docs | Complete (Postgres + live providers pending infrastructure) |

## Implemented capability map

### Storefront
Hero, categories, real best sellers (paid-order ranking), new arrivals, brand story, special collection, occasions, verified reviews, Instagram gallery, newsletter with consent/double opt-in, announcement bar with scheduling, footer with policies.

Shop with combinable filters (category, type, colour, size, price, stock, sale), sorting, pagination, URL-shareable state, search suggestions with recent/popular terms, wishlist, recently viewed, quick add-to-cart with variants and add-ons, stock and low-stock indicators.

### Commerce core
Server-authoritative pricing (`computeTotals`), coupon engine with minimum spend/max cap/usage/per-customer/product/category scoping, guest + member carts with merge on login, cart issue detection (price change, stock, unavailable variant/add-on), transactional checkout with conditional stock decrements, delivery-capacity reservation, idempotency keys, order-item snapshots, coupon usage lock, order-number sequence (`FLW-YYYYMMDD-NNNN`), payment expiry → auto-cancel/restock, refunds (partial/full), fulfilment state machine with eight prep/delivery stages.

### Identity
Email/password (bcrypt, rate limited), LINE Login and Google OAuth with state + PKCE + nonce + JWKS verification, explicit account linking (no email auto-link), email verification, password reset, session revocation, PDPA account deletion, order access via HMAC cookie for guests, protected order tracking with order number + email.

### Admin
Real-time dashboard with period filters, product CRUD (tabs, translations, images with upload/reorder/alt, variants, pricing, inventory, SEO, publishing), category CRUD, inventory adjustments/movements/batches, order management (verify payment, transitions, tracking, notes, refunds, printable documents), customer profiles, coupon management, review moderation + replies, banner/page/FAQ/gallery CMS, bilingual blog, customer broadcast + admin inbox, sales reports + CSV export, staff management, role/permission editor, activity log, store/delivery/payment/SEO settings with integration readiness badges.

### Cross-cutting
TH/EN routes with `hreflang`, canonical URLs, organisation/product/article/breadcrumb JSON-LD, sitemap, robots, security headers (CSP, nosniff, frame options, referrer policy), DB-backed rate limiting, audit logging, sharp-based image validation, responsive layout verified 360→1440 px, loading/empty/error states across flows.

## Verification (latest run)

```text
npm run typecheck  → pass
npm run lint       → pass (warnings only)
npm run build      → pass
npm test           → 26/26
npm run e2e        → 45/45
smoke (30 URLs)    → 30/30
responsive         → no overflow at 360/390/430/768/1024/1440
```

Details: [docs/TESTING_REPORT.md](./docs/TESTING_REPORT.md).

## READY FOR CONFIGURATION (needs credentials/infrastructure)

| Item | What is implemented | What remains |
| --- | --- | --- |
| LINE Login | Full OAuth + PKCE + ID-token verification + linking | Create channel, set 3 env vars, run the checklist in `docs/LINE_LOGIN_SETUP.md` |
| Google Login | Full OIDC flow + verification | Create OAuth client, set env vars |
| LINE Messaging | Push adapter, consent-aware notifications | Messaging API channel token, verify with a real follower |
| Stripe | PaymentIntent (PromptPay) + Checkout (cards) + signed webhooks + refunds | Live/test keys, webhook registration, sandbox transaction test |
| Opn Payments (Omise) | PromptPay source/charge + API-verified webhook + refunds | Live/test keys, webhook URL |
| SMTP email | Nodemailer transport + bilingual templates + `email_log` | SMTP credentials, SPF/DKIM |
| S3/R2 storage | S3 adapter + local driver + validated pipeline | Bucket, CDN, credentials |
| PostgreSQL | Kysely Postgres dialect, portable migrations | Provision instance, run migrations + smoke suite |
| Scheduler | Maintenance endpoint (expiry, cleanup) | Cron every 5 minutes with `CRON_SECRET` |
| Seed demo content | Catalog/content seed with generated brand artwork | Replace with studio photography and real policies |

No fake success state exists for any of the above: where credentials are absent the UI shows configuration state, and no payment/login is simulated in production (`sandbox` refuses to run when `NODE_ENV=production`).

## Known limitations / recommended next steps

1. **Search** uses portable `LIKE` queries. For large catalogs add PostgreSQL full-text (`tsvector`) or an external index (Meilisearch/Typesense) behind `lib/catalog.ts`.
2. **Analytics** are computed on demand with SQL aggregates. Add materialised views if the order table grows into millions of rows.
3. **Image variants** rely on Next.js optimisation or a CDN; pre-generating responsive derivatives is optional.
4. **Automated browser E2E** was performed manually via the in-app browser. Add Playwright specs for CI using the documented journeys.
5. **Cart merge** is triggered on password login and OAuth callback; add a middleware-level merge if you later add other sign-in methods.
6. **Abandoned cart emails** are flagged but not auto-sent; wire a marketing job with explicit consent before enabling.
7. **Rate limiting** is fixed-window in the database; replace with Redis if you need burst smoothing at scale.
8. **Occasion reminder delivery** stores preferences and events; add a daily cron worker (same pattern as maintenance) to send reminders.
9. **Product cost visibility** is limited to settings-level permission; add a dedicated `products.cost.view` permission if roles need finer control.
10. **Localisation of emails** uses the customer locale at order time; ensure admins set the store locale appropriately.

## File map (high level)

```
src/lib/db/            schema, migrations, node:sqlite dialect, db index
src/lib/auth/          session, rbac, password, oauth, service
src/lib/payments/      types, providers (manual/sandbox/stripe/omise), service
src/lib/               pricing, cart, checkout, delivery, catalog, orders, content,
                       settings, notify, email, storage, uploads, rate-limit, audit
src/app/[locale]/      storefront + account + admin + auth screens
src/app/api/           auth callbacks, webhooks, uploads, search, finder, export, cron, health
src/components/        design system, storefront, account, admin components
scripts/               migrate, seed, reset, e2e, smoke
tests/                 pricing, money, i18n, validation
docs/                  installation, env, schema, API, LINE, payments, storage,
                       deployment, admin guide, testing, troubleshooting
```

## Commands

```bash
npm run dev            # development
npm run build && npm start
npm run db:setup       # migrate + seed (local SQLite)
npm run db:migrate
npm test               # 26 unit/integration checks
npm run e2e            # 42 commerce checks on data/e2e.db
node scripts/smoke.mjs http://localhost:3000
```

## Seeded credentials (development only)

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | admin@bloome.local | ChangeMe!2026 |
| Admin | manager@bloome.local | Manager!2026 |
| Customer | customer@bloome.local | Customer!2026 |

Change or disable these before any public deployment.

## Definition of done — self assessment

| Requirement | Status |
| --- | --- |
| Public pages complete | ✅ |
| Consistent premium design, responsive | ✅ (verified breakpoints) |
| Thai + English complete, fallbacks | ✅ (dictionary parity test) |
| LINE Login integration | 🟡 implemented, READY FOR CONFIGURATION |
| Google Login | 🟡 implemented, READY FOR CONFIGURATION |
| Admin login secure | ✅ sessions + RBAC + rate limits |
| Product CRUD, real image upload, variants | ✅ |
| Inventory, search, filters, cart, guest cart, wishlist | ✅ |
| Checkout, delivery scheduling, order creation | ✅ (transactional, tested) |
| Payment integration + webhook verification | 🟡 adapters + verification implemented; live credentials pending |
| Order tracking, customer account | ✅ |
| Admin dashboard, coupons, promotions, CMS | ✅ |
| SEO (metadata, sitemap, JSON-LD, hreflang) | ✅ |
| Security checks | ✅ documented + implemented; external pen-test recommended |
| Tests, production build, documentation | ✅ |
| No critical known bugs | ✅ (defects found in QA were fixed and re-tested) |
