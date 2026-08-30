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

### Q13. What order do grades go in inside the composite notation?

The §5 example reads `21H+83G+7K+10M` — not the grade sort order (M, G, H, K,
B), not alphabetical, not by size. Probably just the order the clerk wrote them.

→ **Assumed:** render in each household's configured grade `sort_order`, so the
same lot always renders identically and the household can make it match their
register. Cheap to change if the paper order turns out to carry meaning.
