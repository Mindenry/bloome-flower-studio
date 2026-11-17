# Deployment

## 1. Provision

| Component | Recommendation |
| --- | --- |
| App server | Node 22+ (container or VM) behind HTTPS |
| Database | Managed PostgreSQL 14+ with daily backups + PITR |
| Object storage | S3/R2 bucket + CDN |
| Email | SMTP provider (SES, Postmark, Mailgun…) |
| Scheduler | Cron every 5 minutes for `/api/cron/maintenance` |
| Monitoring | Uptime check on `/api/health`, log aggregation, error tracking |

## 2. Build and run

```bash
npm ci
npm run build
NODE_ENV=production npm start     # listens on PORT (default 3000)
```

Or with a container:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

`.env.local` is not copied into images — inject environment variables from your platform's secret manager.

## 3. Environment (production minimum)

```env
NODE_ENV=production
APP_URL=https://bloome.example.com
AUTH_SECRET=<48+ random bytes>
CRON_SECRET=<random bytes>
DATABASE_URL=postgresql://…
DATABASE_SSL=true
PAYMENT_PROVIDER=promptpay_omise   # or stripe / manual_bank_transfer
MAIL_DRIVER=smtp
MAIL_HOST=…
MAIL_USER=…
MAIL_PASS=…
MAIL_FROM="BLOOMÉ FLOWER STUDIO <hello@…>"
STORAGE_DRIVER=s3
S3_BUCKET=…
S3_REGION=…
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_PUBLIC_URL=https://cdn.…
```

See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for every variable.

## 4. Database migration

```bash
npm run db:migrate
```

The migration runner is additive-only. Before every release:

1. Back up (`pg_dump --format=custom`).
2. Apply migrations on staging, run `npm run e2e` and `scripts/smoke.mjs`.
3. Take a point-in-time marker, deploy the app, apply migrations to production.
4. Verify `GET /api/health` reports the expected schema and `200`.

First-time seed (fresh production database, no demo data):

```bash
SEED_DEMO_DATA=false npm run db:seed
```

Then sign in with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, change the password and create real staff accounts.

## 5. Scheduler

```cron
*/5 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://bloome.example.com/api/cron/maintenance
```

This expires unpaid orders (restock + release slots), purges sessions/rate limits and flags abandoned carts.

## 6. Uploads

Configure the bucket and CDN per [STORAGE_SETUP.md](./STORAGE_SETUP.md). Ensure the bucket is public-read for media keys or served through a signed CDN.

## 7. Security checklist

- [ ] HTTPS only, HSTS at the edge
- [ ] `APP_URL` is the real HTTPS origin (affects cookies and OAuth)
- [ ] `AUTH_SECRET` and `CRON_SECRET` are unique 32+ byte values
- [ ] Secure cookies confirmed (`Set-Cookie` has `Secure; HttpOnly; SameSite=Lax`)
- [ ] Payment webhook secrets set and endpoints reachable
- [ ] Admin IP allow-list / VPN in front of `/admin` if required
- [ ] Seeded demo accounts disabled or password-rotated
- [ ] Security headers present (CSP, X-Frame-Options, nosniff, Referrer-Policy) — configured in `next.config.ts`
- [ ] Rate limits verified (login, reset, contact, search, uploads)
- [ ] Backups + restore rehearsed
- [ ] PDPA: privacy policy content reviewed, cookie consent active, retention policy agreed

## 8. Post-deploy verification

```bash
node scripts/smoke.mjs https://bloome.example.com
curl -fsS https://bloome.example.com/api/health
```

Then run a manual critical journey: admin adds a product → customer (guest and member) buys it → payment webhook confirms → order becomes paid → admin fulfils → customer receives notification → refund works.

## 9. Rollback

- **App**: redeploy the previous image tag. The schema is additive; older code ignores new columns.
- **Database**: only restore if a migration is destructive (none are). Prefer forward fixes.
- **Payments**: if a provider misbehaves, switch `PAYMENT_PROVIDER` to `manual_bank_transfer` and restart — existing orders remain valid and are verified manually.

## 10. Scaling notes

- The app is stateless: scale horizontally behind a load balancer.
- Sessions and rate limits live in the database, so no sticky sessions are needed.
- Enable Postgres connection pooling (PgBouncer) when running more than a few instances; the app pool is capped at 10 per instance.
- Add a read replica and point analytics-heavy admin queries at it if dashboards become slow.
