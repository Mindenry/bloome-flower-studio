# Testing report

**Environment:** Windows 10, Node 26.13.0, npm 11.20.0, Next.js 15.5.29, SQLite (development database). Date: 18 Nov 2026.

## Summary

| Suite | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Pass, 0 errors |
| ESLint (`npm run lint`) | Pass, warnings only (unused-type annotations) |
| Production build (`npm run build`) | Pass |
| Unit / schema / i18n (Vitest) | **26/26 passed** |
| Commerce integration (`npm run e2e`) | **45/45 passed** |
| HTTP smoke (`scripts/smoke.mjs`) | **30/30 passed** |
| Browser walkthrough (in-app Chromium) | Pass — see below |
| Responsive audit | No horizontal overflow at 360 / 390 / 430 / 768 / 1024 / 1440 |

## Unit & schema tests (`tests/`)

- **Pricing engine (13):** percentage/fixed/free-shipping discounts, max-discount caps, product- and category-scoped coupons, discount never exceeding eligible subtotal, shipping threshold, free-shipping coupons, VAT-inclusive vs VAT-exclusive totals, add-on multiplication, empty cart.
- **Money (4):** satang conversion without float drift, NaN guards, locale-aware formatting, basis points.
- **i18n (3):** Thai and English dictionaries have identical key sets, no empty strings, interpolation and fallback.
- **Validation (6):** checkout accepts valid data and lowercases email, rejects bad postal/phone, requires terms, password strength, sale price cannot exceed regular price.

## Commerce integration test (`npm run e2e`, isolated `data/e2e.db`)

45 assertions covering the full critical path:

1. Migrations run on a clean database.
2. Catalog query returns only published products; detail resolves variants, add-ons and occasions; sale price wins.
3. Guest cart: add line with variant + add-on, quantity and totals, stock guard rejects over-quantity.
4. Coupon evaluation (10%) and invalid-coupon rejection.
5. Quantity update, coupon applied to cart.
6. Order creation inside a transaction: order number, product + variant stock decremented, delivery capacity reserved, order item snapshot, coupon usage recorded, inventory movement written.
7. Idempotent replay returns the same order without duplicating stock.
8. Payment initiation through the sandbox provider; payment remains unconfirmed before the webhook.
9. Signed webhook marks the order paid, increments `sold_count`; duplicate webhook is idempotent; forged signature rejected (HTTP 400).
10. Wrong amount cannot mark an order paid; mismatch leaves the payment unconfirmed.
11. Expired payment cancels the order and restores stock.
12. Partial refund updates the payment to `partially_refunded`.
13. Illegal status jump blocked; legal transition allowed; paid order cannot be silently cancelled.
14. Occasion filtering uses the many-to-many `product_occasions` table; an unmapped occasion returns nothing and product detail exposes its occasions.
15. Guest cart persists; pricing rules verified again at the engine level; expiry sweep runs.

## HTTP smoke test (30 checks)

Public pages (`/th`, `/en`, shop, category, occasion, product, cart, checkout redirect, login, register, forgot password, about, contact, FAQ, blog list + article, care guide, flower finder, policy, order tracking), protected redirects (`/admin`, `/account`), APIs (`/api/health`, search suggest, finder), `sitemap.xml`, `robots.txt`, and a 404. Result: **30/30**.

## Browser walkthrough (real UI, real database)

| Journey | Result |
| --- | --- |
| Customer login (seeded account) | Pass — session cookie, account dashboard |
| Product page → add to cart (variant + quantity) | Pass — header badge updates |
| Apply coupon on cart | Pass — 10% discount and totals recomputed server-side |
| 4-step checkout (contact, delivery slot, gift card, payment, review) | Pass — order `FLW-20261118-0001` created |
| Bank-transfer payment instructions | Pass — order pending, stock 8→7, slot booked, coupon usage recorded |
| Admin login → dashboard | Pass — real KPIs, recent order listed |
| Admin order detail → verify payment → confirm order | Pass — payment succeeded, status `paid` → `confirmed`, timeline updated |
| Admin product create via form | Pass — draft created, price stored correctly after THB→satang fix |
| Admin product edit + variant/stock update | Pass |
| Admin delete product | Pass — hard delete (no order history) |
| Admin image upload (`POST /api/uploads`) | Pass — sharp re-encoded to WebP, metadata stored |
| Admin settings save | Pass — settings persisted and reflected |
| Customer review submission (delivered order only) | Pass — status `pending`, admin notification |
| Admin review approval | Pass — status `approved`, visible on product page |
| All admin pages render (products, inventory, orders, customers, coupons, reviews, content, blog, notifications, staff, roles, activity, settings, reports, categories) | Pass — no error boundary triggered |
| Responsive audit (360, 390, 430, 768, 1024, 1440) | Pass — no horizontal overflow after fixes |

## Defects found and fixed during QA

| # | Defect | Fix |
| --- | --- | --- |
| 1 | Product detail 404 — missing category join | Added `categories` join; errors no longer swallowed |
| 2 | Add-to-cart 500 on existing DBs — missing `unit_price_snapshot` | Added migration `002_cart_price_snapshot` |
| 3 | Cart add-on totals zero | JSON-parse `cart_items.addon_ids` in cart loader |
| 4 | Checkout could never accept terms (state not submitted) | Hidden `acceptTerms`/`anonymous` inputs |
| 5 | Admin product price stored ×100 too small | Convert THB input to satang in the action; variants likewise |
| 6 | Image upload 500 (`colourspace: parameter space not set`) | Deduplicated `sharp@0.35.5` (Next's own nested copy conflicted) |
| 7 | Admin layout overflowed at ≤768 px | Column flex shell + `min-w-0` table wrappers + admin scope rule |
| 8 | Paid/partially-refunded orders could be cancelled or blocked from progression | Payment-state checks include `partially_refunded`; cancel refused when money captured |
| 9 | 404 page had no root layout / corrupted Thai text | Moved not-found into `[locale]`, rewrote content |
| 10 | Review confirmation invisible after revalidation | Review form opens by default for un-reviewed delivered items |

## UX / content verification (second pass)

| Item | Result |
| --- | --- |
| Thai line breaking in header/footer/breadcrumbs | Short UI labels no longer split mid-word (nowrap + tightened columns); product titles may wrap to two lines by design |
| Instant filtering (no apply button) | Pass — selecting category/colour/size/stock updates results via URL in under a second, active filter chips remove filters, mobile drawer applies instantly and shows the result count |
| Occasion mapping | Pass — 10 occasions with 3–12 products each, 8 categories with 2–5 products each, 72 mappings seeded; admin can tick multiple occasions per product |
| Footer newsletter | Pass — input 48 px mobile / 52 px desktop, full-width tap target, consent and success/error states |
| Responsive refresh | Pass — 360/390/430/768/1024/1440, no horizontal overflow on storefront or admin |
| Structured data | Organization, WebSite+SearchAction, Product, Offer, ItemList, BreadcrumbList, Article, FAQ |
| Header layout | Pass — removed the wide tagline under the wordmark, hid Journal/About below xl; nav→logo gap 163 px at 1024 and 82–90 px at 1280/1440 with no overlap |
| Header redesign (v2) | Pass — shrinks 93→71 px on scroll with blur + hairline shadow; editorial mega menu with category imagery and a florist promo card; ⌘K/Ctrl+K search; account and language dropdowns with active states; full-screen mobile drawer with large serif navigation, category imagery and utility links |
| Real photography | Pass — 191 real photographs (Pexels licence) replace generated artwork; 29/29 homepage images load, 54 product images (2 per product), credits page lists every original |
| Photo credits page | Pass — `/th/photo-credits` lists all 191 images with source links; linked from the footer legal bar |

## Not tested (external dependencies)

- Live **LINE Login** and **Google OAuth** (no credentials).
- Live **Stripe** / **Opn Payments** charges, refunds and webhooks (no credentials). Sandbox and manual flows are tested.
- **S3/R2** uploads (no bucket).
- **SMTP** delivery (dev uses the log transport).
- **PostgreSQL** execution (no server available); the schema and dialect are implemented for Postgres but must be validated on target infrastructure.
- Lab-grade Core Web Vitals (Lighthouse) and physical device/browser matrix.

These are marked **READY FOR CONFIGURATION** in `PROJECT_PROGRESS.md` and must be re-tested once credentials/infrastructure are available.
