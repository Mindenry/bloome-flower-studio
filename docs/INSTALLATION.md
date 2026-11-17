# Installation

## Requirements

| Requirement | Notes |
| --- | --- |
| Node.js **20.11+** (22/24/26 tested) | `node:sqlite` requires Node 22.5+ for the zero-install dev database |
| npm 10+ | pnpm/yarn work but scripts assume npm |
| PostgreSQL **14+** | Production only; development defaults to SQLite |
| S3-compatible bucket | Production image storage (Cloudflare R2, AWS S3, MinIO) |

> Node 20 does not include `node:sqlite`. Either use Node 22.5+ or point `DATABASE_URL` at PostgreSQL for local work.

## 1. Install dependencies

```bash
npm install
```

If your npm version blocks install scripts, approve the two native helpers once:

```bash
npm install-scripts approve sharp esbuild
```

## 2. Configure the environment

```bash
cp .env.example .env.local
```

Minimum local values:

```env
APP_URL=http://localhost:3000
AUTH_SECRET=<48-byte random string>
CRON_SECRET=<random string>
DATABASE_URL=file:./data/bloome.db
MAIL_DRIVER=log
PAYMENT_PROVIDER=manual_bank_transfer
STORAGE_DRIVER=local
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Every variable is documented in [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md).

## 3. Create the database

Development (SQLite):

```bash
npm run db:setup      # migrate + seed
```

The SQLite file and WAL files are created under `./data/` (git-ignored).

Production (PostgreSQL) — see [DEPLOYMENT.md](./DEPLOYMENT.md):

```bash
DATABASE_URL=postgresql://user:pass@host:5432/bloome npm run db:migrate
```

## 4. Start the app

```bash
npm run dev
```

Open <http://localhost:3000> — the middleware redirects to `/th` (Thai is the default locale).

## 5. Verify the installation

```bash
npm run typecheck
npm test
npm run e2e
node scripts/smoke.mjs http://localhost:3000
```

Expected: clean typecheck, 26 unit tests pass, 42/42 E2E checks, 30/30 smoke checks.

## 6. Create your first real admin

1. Sign in with the seeded admin, then change the password under **Account → Security**.
2. Create a personal Super Admin under **Admin → Staff**, then disable the seeded accounts.
3. Set `SEED_DEMO_DATA=false` and re-seed only on a fresh database.

Never run the seed against a live production database that already contains customer data — it only inserts when rows are missing, but demo orders/reviews should not exist in production.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for native module, font, image and database issues.
