# Open questions

CLAUDE.md §15 lists eight. Q1–Q8 below are those, unanswered and untouched.
Q9–Q12 came up while building M0/M1 and need Pankaj rather than a guess.

Where a question blocked something, the workaround is recorded so it can be
undone cleanly once there is an answer.

---

## From CLAUDE.md §15 — still open

1. **Lot number format.** `91/251` looks like *store lot / packets* but does not
   hold for `129/321`, `147/101`, `354/55`, `356/74`.
   → `lots.lot_no` is stored as opaque text. Nothing derives anything from it.
2. Is a packet always ~50 kg, or does it vary by grade and cold store?
3. One cold store or several?
4. Who is user number one — Pankaj, or a family member in the village?
5. Is cold storage rent per packet per season, or per month?
   → `cold_stores.rent_per_packet` is seeded **null**, not guessed.
6. Are sales recorded against a whole lot, or can one sale span lots?
7. Does the household have a Google account for the Sheets mirror?
8. Monthly budget for SMS and model calls?

---

## New — found while building

### Q9. The register's composite totals do not equal the sum of their parts

CLAUDE.md §5 gives `111(21H+83G+7K+10M)` as the canonical example. Those parts
sum to **121**, not 111.

That is the same class of discrepancy as Q1 (`147/101` showing 111 packets), so
it is probably one fact, not two. Either the total is recorded independently of
the breakdown, or the example has a typo.

→ **Workaround:** `formatLotBreakdown()` sums the breakdown, because the
breakdown is the only thing the schema stores. It also accepts an explicit
`{ total }` for when we learn the answer, and `parseLotBreakdown()` preserves a
total that disagrees with its parts rather than silently correcting it — so
importing the existing spreadsheet will not destroy the evidence.

**This blocks M5.** The stock register cannot be trusted until we know whether a
total is derived or recorded.

### Q10. When does a crop cycle start?

The app has to put every expense in a cycle from the very first screen.

→ **Assumed:** the cycle runs 1 October to 30 September, so a date in March 2026
belongs to `2025-26`. It is a row in `crop_cycles`, so correcting it is a data
change, not a code change. But every expense entered before it is corrected will
have been filed against the assumed cycle.

### Q11. `expenses.amount` is NOT NULL, but a photo draft has no amount

§6 declares `amount numeric(12,2) not null`. §8.2 requires a draft expense row
created the instant a photo is taken, with `amount = null`.

→ **Resolved as:** drafts exist only in the local database, which carries an
extra `status: 'draft' | 'confirmed'` column. Only confirmed expenses are ever
sent to Postgres, so the NOT NULL constraint stands as written. Flagging it
because it is a real divergence between the two stores, and M2's sync has to
keep honouring it.

### Q12. There is no FK cycle between `expenses` and `receipts`

§6 says to create the tables and add the `receipt_id` constraint in a follow-up
migration, because of a circular FK. As the schema is actually written the
dependency runs one way only: `expenses → receipts → users → households`.

→ **Done as asked anyway:** `0000` creates the tables, `0001` adds the
constraint. It costs nothing and keeps the documented shape. If the cycle was
meant to exist — e.g. `receipts.expense_id` was intended too — that changes the
schema and is worth settling before M3.

### Q14. CLAUDE.md §6 no longer matches the schema — ANSWERED, needs writing up

Decisions taken in conversation on 2026-08-30, all implemented:

- **Sales are of produce, not only potato.** `sales.lot_id` is now **nullable**.
  §6 declares it `not null`, which made a wheat sale impossible to record.
  Cold storage is one route a sale can take, not the only one.
- **New `crops` table.** Reference data seeded with आलू, गेहूं, सरसों, धान, मटर,
  गन्ना, each with a default unit and a `uses_cold_storage` flag. Only potato is
  graded into lots.
- **Expenses gained `crop_id`, `product`, `quantity`, `unit`** — "₹4,500, diesel,
  60 litres, for आलू" rather than just "₹4,500, diesel".
- **Cost *and* income sharing.** `partner_name` + `partner_share` on both
  `expenses` and `sales`. Per transaction, asked each time — not inherited from
  a field or crop.

→ **§6's SQL block is now out of date.** It is the spec, so it should be
updated to match rather than left to drift. Migrations 0002 and 0003 are the
current truth.

### Q15. §16 says no multi-crop before M7, and §13 puts stock at M5

Both were overruled deliberately: the farm grows and sells more than potato, and
modelling it as potato-only was wrong rather than merely early. Recorded because
the file says to flag conflicts rather than silently reorder.

The cost of it stands: no farmer has used M1 yet, so stock and sales were
designed without that feedback.

### Q16. Are units per-household reference data or a fixed list?

§1 says units are configurable reference data. They are currently stored as
plain text on the row, offered as a seeded tap-list (बोरा, कुंतल, किलो, लीटर,
बोरी, ट्रॉली, नग) plus whatever the user types.

→ **Assumed** this is enough. A `units` table would be the fuller reading of §1,
but nothing yet needs to aggregate across units, and it would be a table to
manage for no gain. Revisit at M7, where converting between units to get a
cost-per-unit is a real question.

### Q17. "Lot" now means something different from CLAUDE.md §5 — IMPORTANT

§5's glossary says a lot is **"one deposit into cold storage"**. As of the
2026-08-31 conversation it is **a location inside a cold store**, and the
deposit is a new thing above it:

```
inventory_entry   one consignment, in exactly ONE cold store
  └── lot         a numbered place inside that store ('91/251')
        └── lot_grades   packets per grade
              └── sales  drawn down in instalments
```

An entry may occupy several lots; it may never span two cold stores. That
invariant is the reason the table exists.

→ **§5's glossary and §6's SQL both need updating.** The old `lots` columns
(cold store, crop, stored-on, variety, field) moved up to `inventory_entries` in
migration 0004, which backfills one entry per existing lot so nothing was lost.
0005 then drops them.

This may also bear on Q1: if `91/251` is a *location* rather than a count, the
"store lot / packets" reading was never right, and the mismatches in `129/321`
and `354/55` stop being anomalies. Worth checking against the paper register.

### Q18. Khata is now the organising unit — ANSWERED

A खाता is the record for one venture, usually one crop for one season. Every
expense and every earning belongs to exactly one. Decisions taken:

- **Partner shares live on the khata**, as percentages, and every entry inherits
  them. An entry can override: `sharing_mode` is `khata` (follow the agreement),
  `none` (all the household's), or `custom` (a rupee split on the row).
- **"Generic or common" means odds and ends inside one khata** — a repair, a tea
  stall bill. There is no cross-khata allocation, and no farm-wide overhead
  bucket to split at settlement.
- **Settlement closes a khata.** It computes each partner's slice from the
  *gross* balance and the agreed percentages, and the khata becomes read-only.
  Rounding drift is absorbed by the household's own row so the parts always add
  back to the whole.
- A settled khata can be reopened; it does not lock permanently.

### Q19. What protection is actually in place — and what is not

The link was never the exposure. There is no server: every record lives in
IndexedDB on the phone that entered it, so opening the URL gets an empty app.

What is now in place is a **4-digit PIN gate** — PBKDF2-SHA256, salted, the PIN
itself never stored, back-off after repeated wrong guesses, auto-lock after five
minutes in the background.

→ **It is a gate, not encryption.** Anyone who attaches a debugger to the
browser can still read the records. Encrypting them would mean encrypting every
indexed field and losing offline querying, which §2.1 does not permit. There is
also deliberately **no PIN reset**: this is a household's only copy and no path
may destroy it.

Real per-user protection is M2's accounts, still blocked on DLT registration for
OTP (§4). **That registration has not been started — it takes days and blocks
auth testing.**

### Q20. Bottom navigation vs §10's "no tabs"

§10 forbids "tabs within a task", nested navigation, and hamburger menus that
hide primary actions. The app now has a **bottom navigation bar** with four
top-level destinations (घर, खाते, माल, खर्च).

Read as: that rule is about not fragmenting a *task*, and about not hiding
things. A persistent top-level bar does neither — it is always visible, sits in
the bottom third where a thumb reaches, and is the model our users already know
from WhatsApp and YouTube. Forms and detail screens still present full-screen
with a back arrow and no bar, so one task still owns one screen.

→ **Flagging it because it is a judgement call against the letter of §10.** Easy
to remove if you disagree; it is one component and one prop.

### Q21. Season totals were wrong for khata-inherited splits — FIXED

Found while rebuilding the UI. `seasonTotal` and `seasonIncome` computed the
household's share from `partner_share` on the row, which is null when an entry
inherits its khata's percentages. A half-shared expense therefore counted in
**full** on the home screen and the expense list, while the khata's own balance
had it right — two different numbers for the same money.

Now resolved through `db/shares.ts`, which loads each khata's partners before
totalling. Covered by `src/test/shares.test.ts` so it cannot come back.

### Q24. The season is derived again, not typed

Q-earlier added an editable season on the khata. Making the year book key on
the opening date put those in conflict: a user could label a khata 2024-25 and
still find it filed under 2025-26.

→ The season is now **always derived from `opened_on`** and shown read-only.
One question, one answer. `khatas.season` is still stored — the Sheets mirror
at M4 will want it as a column rather than recomputing — but it is never typed.

Which means the October turnover (Q10) now decides which book a khata lands in,
not just a label. **Still an assumption.** If this district turns over
elsewhere, `SEASON_START_MONTH` is the one constant to change, and khatas near
the boundary would move between books.

### Q22. Crop durations are guesses

The twelve seeded crops carry a `defaultDurationMonths` used to prefill a
khata's intended length: chilli 6, capsicum 5, cucumber 3, cauliflower 4,
muskmelon 3, watermelon 3, arbi 6, kashifal 4, petha 5, potato 5, bajra 4,
wheat 6.

→ **Assumed from general practice, not from this farm.** They only prefill an
editable field, so a wrong one costs a tap. Worth correcting against what is
actually planted.

Also worth confirming the transliterations: कशीफल for Kashifal, बाजरा for
"Bazara", गेहूँ with the nukta.

### Q23. Maps for fields — ANSWERED, partly built

Asked: can fields be pointed to on a map, and given IDs?

**IDs already exist.** Every field has had a UUID since M0, and khatas,
expenses, sales and inventory entries all reference it. If what is wanted is a
*human-readable* code ("K-3") that is a small addition — say so.

**Location is now captured, without a map.** A field can be marked by standing
in it and tapping once; `navigator.geolocation` gives a fix with no network and
no library, so it stays inside offline-first (§2.1) and costs nothing against
the 200 KB budget (§2.5). Latitude, longitude and accuracy are stored per field.

**Map *display* is deliberately not built.** It needs two things offline-first
does not give:

1. **Tiles come over the network.** A map in a cold store or a field with no
   signal shows grey squares. Caching tiles for an area is possible but is real
   work and real storage on a phone whose owner already complains it is full.
2. **A map library is 40 KB+ gzipped** against a 200 KB budget currently at
   ~145 KB. Leaflet is the smallest credible option.

→ **Recommendation:** leave it. The coordinates are captured, so a map can be
added any time it earns its place — and the thing it would mostly be used for,
"which plot did I mean", is already answered by the plot's name. Revisit if
someone actually gets lost.

Boundaries (walking a plot's perimeter to get its area) would be a different and
more valuable feature than a pin, and would give `fields.area_bigha` for free.
Not built; worth discussing.

### Q13. What order do grades go in inside the composite notation?

The §5 example reads `21H+83G+7K+10M` — not the grade sort order (M, G, H, K,
B), not alphabetical, not by size. Probably just the order the clerk wrote them.

→ **Assumed:** render in each household's configured grade `sort_order`, so the
same lot always renders identically and the household can make it match their
register. Cheap to change if the paper order turns out to carry meaning.
