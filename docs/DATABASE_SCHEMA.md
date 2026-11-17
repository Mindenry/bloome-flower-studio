# Database schema

Defined in `src/lib/db/schema.ts` (TypeScript) and created by `src/lib/db/migrations.ts`.

## Conventions

| Concern | Approach |
| --- | --- |
| Primary keys | Prefixed ULID-like text IDs (`usr_…`, `ord_…`) generated in application code |
| Money | Integer **satang** (1 THB = 100 satang). Never floating point |
| Timestamps | ISO-8601 UTC text — lexicographically sortable in SQLite and Postgres |
| Booleans | Integer `0`/`1` for cross-engine portability |
| Localisation | `*_translations` tables keyed by `(entity_id, locale)` |
| Deletes | `deleted_at` / `archived_at` soft deletes for catalog + customers; order and payment history is never deleted |
| Order history | `order_items` stores a full snapshot (name TH/EN, SKU, variant, price, add-ons, image, JSON snapshot) |

## Entity groups

### Identity & access
`roles`, `users`, `accounts` (LINE/Google links), `sessions` (hashed token, expiry, revocation), `auth_tokens` (email verification / password reset), `oauth_states` (state, nonce, PKCE verifier, expiry), `addresses`.

### Catalog
`categories` + `category_translations` (kind: category / collection / occasion), `products`, `product_translations`, `product_images`, `product_variants`, `product_occasions` (many-to-many: a product can belong to several occasions), `addons`, `inventory_movements`, `inventory_batches`.

Key catalogue columns: `sku` (unique), `slug` (unique), `status` (draft/published/scheduled/archived), `published_at`, `price`, `sale_price`, `cost_price` (never exposed publicly), `stock_quantity`, `low_stock_threshold`, `flower_type`, `flower_color`, `bouquet_size`, `flower_count`, `sold_count`, `view_count`.

### Cart
`carts` (member or guest token, coupon, status), `cart_items` (product, variant, add-on JSON + signature, quantity, last price snapshot), `wishlists`, `wishlist_items`, `recently_viewed`.

### Orders & payments
`orders`, `order_items`, `order_events` (customer-visible flag), `payments`, `payment_transactions` (unique provider event ID), `refunds`, `shipping`, `delivery_slots` (per-date capacity), `delivery_blocked_dates`, `coupons`, `coupon_usages` (unique per order), `sequences` (daily order numbering), `webhook_events` (unique provider+event).

Order status flow is enforced by `ORDER_TRANSITIONS` in `src/lib/orders.ts`; payment transitions by `PAYMENT_TRANSITIONS` in `src/lib/payments/index.ts`.

### Content & engagement
`banners`, `content_pages` + translations, `faqs`, `blog_posts` + translations, `care_guides` + translations, `site_gallery`, `reviews` (unique per order item, verified only), `review_images`, `notifications`, `newsletter_subscribers`, `occasion_reminders`, `recipients`.

### Operations
`store_settings` (key/value JSON), `activity_logs`, `uploads`, `email_log`, `rate_limits`, `_migrations`.

## Integrity rules

- Unique: product SKU/slug, variant SKU per product, coupon code, order number, idempotency key, provider event ID, `(provider, event_id)`, one review per order item, one coupon usage per order, one cart line per `(cart, product, variant, addon signature)`.
- Foreign keys with cascade on translations/images/items; `orders.user_id` set null when a customer is deleted (financial records retained).
- Checkout decrements stock with a conditional `WHERE stock_quantity >= qty` guard inside a transaction; delivery capacity uses a conditional increment; both roll back on failure.
- Indexes cover status filters, slugs, date ranges, customer lookups, order number, payment reference and review moderation.

## Migrations

```bash
npm run db:migrate     # applies pending migrations in order, tracked in _migrations
```

Migration 001 creates the full schema; migration 002 adds the cart price snapshot used for "price changed" warnings; migration 003 adds `product_occasions` so products appear under both a category and any number of occasions.

To add a migration, append to the `migrations` array with a unique name and a portable `up(db)` using Kysely's schema builder. Test on SQLite **and** Postgres.

## Backup & recovery

- **PostgreSQL**: nightly `pg_dump --format=custom`, retained 30 days, plus continuous WAL archiving or managed PITR. Test a restore quarterly into a staging database.
- **Uploads**: enable bucket versioning (S3) or snapshot the upload volume.
- **Recovery order**: database → object storage → application deploy of the matching release tag. The application is stateless apart from the database and storage.
- Never restore a backup into production without replaying `npm run db:migrate` to reach the current schema.
