# किसान मित्र / Kisan Mitra

Digital records of farm expenses, cold storage stock and sales, for potato
farmers in Uttar Pradesh. Offline-first PWA.

See [CLAUDE.md](CLAUDE.md) for the product rules — it is the spec, not a summary
of one. See [docs/open-questions.md](docs/open-questions.md) for what is still
unknown and what was assumed in the meantime.

**Shipped so far: M0 (scaffold) and M1 (expenses offline).**

## Layout

```
apps/web        the PWA — React, Dexie, Tailwind. M1 lives here.
apps/api        Fastify + Postgres + Drizzle. Schema, migrations, seed.
packages/shared Drizzle schema, inferred types, domain helpers.
```

`packages/shared` is the source of truth for types: they are inferred from the
Drizzle schema, never hand-written twice. The schema itself sits behind the
`@kisanmitra/shared/schema` subpath so no ORM runtime reaches the web bundle.

## Running it

Node 22+ and Postgres.

```bash
npm install

# API — only needed for schema work; M1 does not talk to it.
createdb kisanmitra
cp apps/api/.env.example apps/api/.env
npm run db:migrate
npm run db:seed          # prints DEV_HOUSEHOLD_ID / DEV_USER_ID for .env
npm run dev:api

# The app
npm run dev
```

```bash
npm test          # shared domain helpers + the expense entry flow
npm run typecheck
npm run build     # prints gzipped bundle sizes — the 200 KB budget is §2.5
```

## What M1 does

Photograph a receipt or enter an expense by hand; see the season's total and its
register. All of it on the phone, none of it needing a network.

The photo is downscaled to 1600 px / q0.8 and written to IndexedDB before
anything else happens, along with a draft expense — so an interrupted capture
still leaves the user holding their receipt.

There is no server call anywhere in `apps/web`. That is checked by grep, not by
intention:

```bash
grep -rnE '\bfetch\(|XMLHttpRequest|axios' apps/web/src   # expected: nothing
```

Records carry a `syncState`, and every M1 row sits at `pending` and says "saved
on this phone". When M2 adds the outbox it drains exactly those rows, so a month
of offline-only use syncs up rather than needing a backfill.

## Migrations

Forward-only and checked in. Never edit one that has been applied.

```bash
npm run db:generate -w @kisanmitra/api   # after changing the schema
```
