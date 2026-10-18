# QBO Financial Dashboard

![License: MIT](https://img.shields.io/badge/license-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Postgres](https://img.shields.io/badge/Postgres-Neon-informational)

A QuickBooks Online "financial control room": it connects to a QuickBooks Online company via OAuth, syncs customers, vendors, invoices and bills into Postgres, and shows receivables/payables totals, aging buckets, status splits and monthly revenue charts.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS, Recharts, Drizzle ORM on Neon Postgres, `intuit-oauth`.

## Getting started

```bash
npm install
cp .env.example .env.local   # or create .env.local with the variables below
npm run db:push              # create tables
npm run dev
```

Open http://localhost:3000 and connect your QuickBooks company.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon/Postgres connection string |
| `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` | Intuit developer app credentials |
| `QBO_REDIRECT_URI` | OAuth callback, e.g. `http://localhost:3000/api/qbo/callback` |
| `QBO_ENV` | `sandbox` or production |
| `APP_ENCRYPTION_KEY` | 64 hex chars; encrypts stored QuickBooks tokens |
| `SYNC_SECRET` | Shared secret for the sync endpoint |

Incremental sync: `POST /api/sync` with header `x-sync-secret: $SYNC_SECRET` (call it from a scheduler).

## Scripts

`npm run dev`, `build`, `start`, `lint`, `db:generate`, `db:push`, `check:crypto` (token encryption round-trip), `reset:watermark` (force a full re-sync).

## Structure

```
src/app/        pages, server actions, API routes (qbo connect/callback, sync)
src/components/ dashboard charts
src/db/         Drizzle schema and client
src/lib/        QBO client, sync, metrics, token crypto
scripts/        maintenance scripts
```

## License

MIT. See [LICENSE](LICENSE).
