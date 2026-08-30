# CLAUDE.md — Farm Stock & Expense App

Instructions for Claude Code working in this repository. Read this fully before writing code. When something here conflicts with a request in chat, say so rather than silently picking one.

---

## 1. What we are building

A mobile-first app for potato farmers in a village in Uttar Pradesh, India, to keep digital records of:

1. **Expenses per crop cycle** — captured mostly by photographing a paper receipt.
2. **Cold storage stock** — which lots are stored where, of which variety, in which grades, and how many packets.
3. **Sales against those lots** — potatoes leave storage in instalments, not all at once.

The end goal is a per-packet cost of production number, which nobody in the village currently knows.

The existing system is a spreadsheet register kept for the cold store (G.L. Cold Storage, Chitaura). That register works. We are digitising it, not redesigning it. Anything on screen should be recognisable to someone who has kept that register by hand.

Longer term this generalises to other crops and other small producers, so **nothing potato-specific may be hardcoded**. Grades, varieties, field names, expense categories and units are all configurable reference data, seeded with potato values.

---

## 2. Prime directives

These are not negotiable. If a task seems to require breaking one, stop and ask.

1. **Offline first.** The app must be fully usable with no network. Cold stores are thick-walled and rural data is patchy. Every write goes to the local database first and syncs later. Never block a user action on a network call.
2. **The photo is the record.** A receipt photo is saved locally the instant it is taken, before any extraction, before any network. If everything else fails, the user still has their receipts. Never delete a photo automatically.
3. **Never auto-commit extracted data.** Model output from a receipt is always a *suggestion* shown next to the photo for the user to confirm or correct. Store both the raw extraction and the confirmed values.
4. **No typing where a tap or a voice note will do.** Typing on a phone keyboard is the single biggest barrier for our users.
5. **Small bundle.** Assume a ₹6,000 Android phone on 3G. Budget: initial JS payload under 200 KB gzipped. Justify any dependency that adds more than 20 KB.
6. **Hindi is the primary language**, English is secondary. No user-facing string may be hardcoded in a component.
7. **Never lose a record.** Sync is append-and-reconcile, never destructive. Deletes are soft deletes.

---

## 3. Who uses this

- **Primary user:** a farmer, 35–60, owns a smartphone, uses WhatsApp and YouTube daily, may read Hindi slowly and English barely, has never installed an app from a store deliberately. Has 32 GB of storage and complains it is full.
- **Secondary user:** a younger family member (often the one who currently maintains the spreadsheet) who is comfortable with phones and will do the fuller stock entry.
- **Read-only audience:** commission agents, an accountant, elders in the family. These people want to see a spreadsheet. That is why the Google Sheets mirror exists.

Design for the primary user. Test with the primary user.

---

## 4. Stack

Decided. Do not change without asking.

**Client** — installable PWA, not a native app. No app store, no install friction, updates instantly.

- Vite + React + TypeScript
- Tailwind CSS
- Dexie (IndexedDB) for the local database
- Workbox service worker for offline shell + photo caching
- `react-i18next` for strings
- Web Speech API for voice input, with graceful fallback

**Server** — runs on the existing self-hosted box.

- Node 22 + Fastify + TypeScript
- PostgreSQL + Drizzle ORM
- Photos on the local filesystem, served via signed URLs. Keep the storage layer behind an interface so it can move to S3/MinIO later.
- A single long-lived process; no serverless.

**External services**

- Receipt extraction: a vision model behind an `ExtractionProvider` interface. Start with Gemini Flash; Claude Haiku is the fallback. The rest of the code must not know which one is in use.
- SMS OTP: MSG91. Note that transactional SMS in India requires DLT template registration — flag this to Pankaj early, it takes days to clear and blocks auth testing.
- Google Sheets API v4 via a service account, write-only from the server.

**Not using:** any native mobile framework, any BaaS, Firebase, or Supabase, any auth SaaS, any component library beyond Tailwind primitives.

---

## 5. Domain glossary

Use these terms in code and in the UI. Do not invent English replacements.

| Term | Hindi | Meaning |
|---|---|---|
| Packet | बोरा / packet | One sack of potatoes, the atomic unit of stock. Roughly 50 kg — confirm before relying on it. |
| Lot | लॉट | One deposit into cold storage, identified by a lot number like `91/251`. Has one variety and one source field, but a mix of grades. |
| Field | खेत | A named plot of land: Jaynagar, Bhagat, GG, Saudan, Bijali, Gadhi, "3 Bigha". These are informal names, not survey numbers. |
| Variety | किस्म | Seed variety, recorded as a code: `37-97`, `302`. Free text with autocomplete, not an enum. |
| Crop cycle | — | One season, e.g. 2025-26. Expenses and sales roll up to this. |

**Grades** — the size/quality sort a lot is split into. Single-letter codes in the register:

| Code | Hindi | Roman | Meaning |
|---|---|---|---|
| M | मोटा | Mota | Large potato |
| G | गुल्ला | Gulla | Small, round |
| H | हरा | Hara | Green (sun-exposed, lower value) |
| K | किर्री | Kirri | Very small / undersized |
| B | — | Bumper | Bumper grade |

In the UI, grades are shown as a **photograph of the actual potato grade plus the Hindi word**, never as a bare letter. The letters are for storage and for the printed register only.

**Composite packet notation.** The paper register writes a lot's contents as `111(21H+83G+7K+10M)` — total, then the per-grade breakdown. Store this normalised across rows, but **always render it back in this exact format** wherever a lot is displayed. This format is the thing that makes the screen legible to someone who has kept the register by hand. Write a single `formatLotBreakdown(lot)` helper and use it everywhere.

---

## 6. Data model

Postgres is authoritative. Dexie mirrors the same shape client-side with an added `syncState` column.

```sql
-- Reference data. Seeded with potato values, editable per tenant.
create table households (
  id uuid primary key,
  name text not null,
  village text,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  household_id uuid not null references households(id),
  phone text not null unique,          -- E.164
  display_name text not null,
  role text not null default 'member', -- 'owner' | 'member' | 'viewer'
  created_at timestamptz not null default now()
);

create table crop_cycles (
  id uuid primary key,
  household_id uuid not null references households(id),
  label text not null,                 -- '2025-26'
  starts_on date not null,
  ends_on date,
  is_current boolean not null default false
);

create table fields (
  id uuid primary key,
  household_id uuid not null references households(id),
  name text not null,                  -- 'Jaynagar', '3 Bigha'
  area_bigha numeric(8,2),
  sort_order int not null default 0,
  archived_at timestamptz
);

create table grades (
  id uuid primary key,
  household_id uuid not null references households(id),
  code text not null,                  -- 'M', 'G', 'H', 'K', 'B'
  label_hi text not null,              -- 'मोटा'
  label_en text not null,              -- 'Mota (large)'
  photo_url text,
  sort_order int not null default 0,
  unique (household_id, code)
);

create table cold_stores (
  id uuid primary key,
  household_id uuid not null references households(id),
  name text not null,                  -- 'G.L. Cold Storage, Chitaura'
  rent_per_packet numeric(10,2)
);

-- Core stock records.
create table lots (
  id uuid primary key,
  household_id uuid not null references households(id),
  crop_cycle_id uuid not null references crop_cycles(id),
  cold_store_id uuid references cold_stores(id),
  lot_no text not null,                -- '91/251' exactly as written on paper
  serial_no int,                       -- S. NO. in the paper register
  stored_on date not null,
  room_rack text,
  variety text,                        -- '37-97', '302'
  field_id uuid references fields(id),
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table lot_grades (
  id uuid primary key,
  lot_id uuid not null references lots(id) on delete cascade,
  grade_id uuid not null references grades(id),
  packets int not null check (packets >= 0),
  unique (lot_id, grade_id)
);

-- Potatoes leave storage in instalments. Many sales per lot.
create table sales (
  id uuid primary key,
  household_id uuid not null references households(id),
  lot_id uuid not null references lots(id),
  sold_on date not null,
  buyer text,
  rate_per_packet numeric(10,2),
  total_amount numeric(12,2),
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table sale_grades (
  id uuid primary key,
  sale_id uuid not null references sales(id) on delete cascade,
  grade_id uuid not null references grades(id),
  packets int not null check (packets > 0),
  rate_per_packet numeric(10,2),       -- grades often fetch different rates
  unique (sale_id, grade_id)
);

-- Expenses.
create table expense_categories (
  id uuid primary key,
  household_id uuid not null references households(id),
  key text not null,                   -- 'seed','fertiliser','labour','diesel','transport','storage_rent','other'
  label_hi text not null,
  label_en text not null,
  icon text,
  sort_order int not null default 0
);

create table expenses (
  id uuid primary key,
  household_id uuid not null references households(id),
  crop_cycle_id uuid not null references crop_cycles(id),
  category_id uuid references expense_categories(id),
  field_id uuid references fields(id),  -- null = whole farm
  spent_on date not null,
  amount numeric(12,2) not null,
  vendor text,
  notes text,
  receipt_id uuid references receipts(id),
  entry_method text not null,           -- 'photo' | 'manual' | 'voice' | 'whatsapp'
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table receipts (
  id uuid primary key,
  household_id uuid not null references households(id),
  photo_path text not null,
  photo_hash text not null,             -- dedupe, and idempotency for sync
  captured_at timestamptz not null,
  extraction_status text not null,      -- 'pending'|'done'|'failed'|'skipped'
  extraction_provider text,
  extraction_raw jsonb,                 -- exactly what the model returned
  extraction_confidence jsonb,          -- per-field 0..1
  confirmed_at timestamptz,
  confirmed_by uuid references users(id)
);
```

Note the circular FK between `expenses` and `receipts` — create the tables, then add the `receipt_id` constraint in a follow-up migration.

**Everything is scoped by `household_id`.** Every query filters on it. Write a repository layer that makes it impossible to forget.

---

## 7. Sync

The design goal is that a farmer can be offline for a week and lose nothing.

- Every mutation writes to Dexie and appends an entry to an **outbox** table: `{ id, entity, entityId, op, payload, createdAt, attempts }`.
- A background sync task drains the outbox in order when online. Failed items retry with exponential backoff and stay in the queue.
- **All IDs are UUIDv7 generated on the client.** No server-assigned IDs, no temp-ID rewriting.
- Server endpoints are **idempotent by record ID**. Replaying the outbox must be safe.
- Conflict rule: last-write-wins on `updated_at` per record, with the loser's version written to an `overwrites` audit table so nothing is truly lost. Expenses and sales are effectively append-only in practice, so conflicts should be rare.
- Photos upload separately from records, on a lower-priority queue, and only on wifi by default (make this a setting). A record is valid without its photo having uploaded yet.
- The UI shows sync state honestly: a small per-record indicator, and a count of pending items. Do not show a spinner that implies the user must wait.

---

## 8. Receipt capture pipeline

1. User taps the camera button. Photo captured, downscaled client-side to max 1600 px on the long edge, JPEG quality 0.8. Original is not kept — this is the one place we compress, because storage is scarce.
2. Photo written to Dexie immediately. An expense draft row is created immediately with `amount = null`.
3. If online, the photo uploads and the server calls the extraction provider. If offline, this sits in the queue.
4. Extraction asks for strict JSON: `{ vendor, date, total, currency, line_items[], category_guess, confidence: { field: 0..1 } }`. The prompt must state that receipts may be handwritten in Hindi, that amounts are in rupees, and that it should return null rather than guess.
5. Results come back to the client and pre-fill the confirmation screen: **photo on top, fields below, tappable to correct.** Fields with confidence below 0.7 are visually flagged. Amount and date are mandatory; everything else is optional.
6. On confirm, the confirmed values are written to `expenses` and `receipts.confirmed_at` is set. The raw extraction is retained forever.

Accuracy on handwritten carbon-paper receipts will be mediocre. That is expected and acceptable — the photo plus a confirmed amount and date already beats a shoebox. Do not add complexity chasing line-item accuracy.

Over time `extraction_raw` next to the confirmed values becomes a labelled dataset of exactly the receipts our users get. Keep it clean.

---

## 9. Google Sheets mirror

The spreadsheet is a **read-only output**, never an input. This is important — do not build write-back.

- One Google Sheet per household per crop cycle, with tabs: `Stock Register`, `Sales`, `Expenses`, `Summary`.
- The `Stock Register` tab reproduces the paper register's columns exactly, in order: S. No. | Date | Lot No. | No. of Packets | Packets | Room/Rack | Variety | Field | Selling Details. Including the `111(21H+83G+7K+10M)` composite format and the NOTE legend at the bottom.
- Rebuilt from Postgres on a schedule (every 15 min) and on demand. Idempotent full rewrite of the data range; do not attempt incremental row edits.
- If the Sheets API fails, log it and carry on. Sheets is never in the critical path.

---

## 10. UI rules

Write copy from the user's side of the screen. Buttons say what happens: "Save expense", not "Submit". The word on the button is the word in the confirmation.

- **One task per screen.** No tabs within a task, no nested navigation, no hamburger menu hiding primary actions.
- **Three things on the home screen**, large: add expense (camera), add stock, see this season. Nothing else above the fold.
- Touch targets minimum 56 px. Assume a cracked screen and a thumb with soil on it.
- High contrast, readable in direct sunlight. No light grey on white anywhere.
- Amounts in Latin digits (`4500`) — faster to read on a phone than Devanagari numerals — with the `₹` symbol and Indian digit grouping (`₹4,500`). Labels in Hindi.
- Dates: show `27/02/2025` format, matching the register. Default to today, one tap to change.
- Voice input on every free-text and amount field. The microphone is a first-class control, not a secondary affordance.
- Grades shown as photograph + Hindi word. Numbers entered with a stepper and a number pad, never a generic keyboard.
- Empty states tell the user what to do next, in one sentence. Errors say what went wrong and what to do, and never apologise.
- Everything works one-handed. Primary actions live in the bottom third of the screen.

Accessibility floor, without announcing it: visible focus states, `prefers-reduced-motion` respected, real semantic elements.

---

## 11. Internationalisation

- `hi` is the default and the fallback. `en` exists for Pankaj and for debugging.
- No user-facing string in a component. Everything through `t()`.
- Keys are semantic (`expense.form.amountLabel`), not English text.
- Hindi is written by a human, not machine-translated. Where we don't have a translation yet, leave the key visible in dev and fall back to English in prod, so gaps are obvious.
- Domain words stay in Hindi in *both* locales: बोरा, मोटा, गुल्ला. Do not translate मोटा to "large" in the Hindi UI.

---

## 12. Auth

- Phone number + 6-digit SMS OTP. No email, no password, ever.
- Session token in a long-lived httpOnly cookie. Expiry measured in months, not hours — re-authentication is a support call in this context.
- A household is created by its first user; others join via a 6-digit invite code shared over WhatsApp.
- Roles: `owner` (can invite, can edit reference data), `member` (can create and edit records), `viewer` (read-only, for the accountant).
- OTP in development is a fixed code so we are not blocked on DLT registration.

---

## 13. Build order

Ship each milestone to real users before starting the next. Do not build ahead.

- **M0 — Scaffold.** Monorepo (`apps/web`, `apps/api`, `packages/shared`). Types, schema, migrations, seed data for one household. No auth yet, hardcoded user.
- **M1 — Expenses offline.** Camera capture, local storage, manual amount/date/category entry, list and total for the current crop cycle. Fully offline, no server. **This alone is a usable product.** Get five farmers using it for a month.
- **M2 — Auth + sync + photo upload.** Outbox, idempotent endpoints, conflict audit, sync indicators.
- **M3 — Extraction.** Vision provider, confirmation screen, confidence flags.
- **M4 — Sheets mirror.** Expenses tab first, then Summary.
- **M5 — Stock register.** Lots, grades, composite format, the Stock Register tab.
- **M6 — Sales.** Partial sales against lots, remaining-packets calculation.
- **M7 — Cost per packet.** The number that makes people talk about the app. Expenses per crop cycle ÷ packets produced, split by field and by grade where the data allows.
- **M8 — WhatsApp bot.** Photo to the bot logs an expense. Nothing to install. Likely the widest-reach surface — treat it as a first-class client of the same API, not a bolt-on.

---

## 14. How to work in this repo

- **Small changes.** One milestone slice at a time. Do not refactor adjacent code opportunistically.
- **Ask before adding a dependency.** State the size and what it replaces.
- Types are shared in `packages/shared` and derived from the Drizzle schema. Do not hand-write duplicate interfaces.
- No `any`. No non-null assertions without a comment saying why.
- Tests: the sync engine, the outbox, and `formatLotBreakdown` are the parts that must have real tests. UI tests only for the expense entry flow. Do not chase coverage.
- **Every feature must be tested with the network off** before it is considered done. If you cannot verify this yourself, say so explicitly in your summary.
- Migrations are forward-only and checked in. Never edit an applied migration.
- Commit messages describe behaviour change, not files touched.
- When you finish a task, say what you did **not** do and what you assumed.

---

## 15. Open questions — ask, do not assume

These are genuinely unknown. Ask Pankaj rather than guessing, and record the answers here.

1. **Lot number format.** `91/251` looks like *store lot / packets*, and mostly matches: `95/71` → 71 packets. But `129/321` shows 311 packets, `147/101` shows 111, `354/55` shows 33, and `356/74` shows 96. Are these withdrawals, corrections, typos, or a different convention? The answer becomes a validation rule — until then, store `lot_no` as opaque text and do not derive anything from it.
2. Is a packet always ~50 kg, or does it vary by grade and by cold store?
3. Does the family deal with one cold store or several?
4. Who is user number one — Pankaj, or a family member in the village? Everything about onboarding depends on this.
5. Is cold storage rent charged per packet per season, or per month? It is a real expense line and needs modelling.
6. Are sales recorded against a whole lot or can one sale span multiple lots?
7. Does the household already have a Google account we can put the Sheets under?
8. Budget for SMS and model calls per month, so we know what "cheap enough" means.

---

## 16. Out of scope

Say no to these, politely, if they come up:

- Weather forecasts, mandi price feeds, crop advisory, government scheme information. Every farming app in India does this and it is why none of them get used for bookkeeping.
- Marketplace or buyer matching.
- Loans, credit scoring, or anything touching regulated finance.
- A native app, until the PWA has proven demand.
- Multi-crop support before M7. The schema allows it; the UI should not attempt it yet.
