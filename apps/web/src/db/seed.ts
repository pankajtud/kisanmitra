/**
 * First-run reference data, created locally with client-generated UUIDv7 IDs.
 *
 * M1 has no server, so the phone is the origin of this household's data. Because
 * IDs are client-generated and never rewritten (CLAUDE.md §7), the same rows
 * push up unchanged when M2 adds auth and sync — nothing has to be reconciled.
 *
 * Everything here is editable reference data seeded with potato values, not a
 * hardcoded assumption (§1).
 */
import {
  SEED_COLD_STORE,
  SEED_CROPS,
  SEED_EXPENSE_CATEGORIES,
  SEED_FIELDS,
  SEED_GRADES,
  uuidv7,
} from '@kisanmitra/shared';
import { db } from './db.js';
import { reconcileCrops } from './crops.js';

/**
 * The potato year in this district runs roughly October to September, so a date
 * in, say, March 2026 belongs to the 2025-26 cycle.
 *
 * ASSUMPTION, not confirmed with Pankaj — see docs/open-questions.md Q10. The
 * cycle is an editable row, so correcting it later is a data change, not a
 * code change.
 */
const CYCLE_START_MONTH = 9; // October, zero-based

export function currentCycleLabel(now = new Date()): { label: string; startsOn: string } {
  const startYear = now.getMonth() >= CYCLE_START_MONTH ? now.getFullYear() : now.getFullYear() - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return {
    label: `${startYear}-${endShort}`,
    startsOn: `${startYear}-${String(CYCLE_START_MONTH + 1).padStart(2, '0')}-01`,
  };
}

export interface AppContext {
  householdId: string;
  userId: string;
  cropCycleId: string;
}

/** Idempotent: returns the existing household if there is one. */
export async function ensureSeeded(now = new Date()): Promise<AppContext> {
  const existing = await db.households.toCollection().first();
  if (existing) {
    const user = await db.users.where('householdId').equals(existing.id).first();
    const cycle =
      (await db.cropCycles.where('householdId').equals(existing.id).filter((c) => c.isCurrent).first()) ??
      (await db.cropCycles.where('householdId').equals(existing.id).first());

    if (user && cycle) {
      // Reference data only — no user record is touched. New crops appear,
      // ones dropped from the seed are archived rather than deleted so old
      // records still resolve, and anything the household added stays.
      await reconcileCrops(existing.id, SEED_CROPS);
      return { householdId: existing.id, userId: user.id, cropCycleId: cycle.id };
    }
  }

  const householdId = uuidv7();
  const userId = uuidv7();
  const cropCycleId = uuidv7();
  const { label, startsOn } = currentCycleLabel(now);
  const createdAt = now.toISOString();

  await db.transaction(
    'rw',
    [
      db.households,
      db.users,
      db.cropCycles,
      db.crops,
      db.grades,
      db.expenseCategories,
      db.fields,
      db.coldStores,
    ],
    async () => {
      await db.households.put({
        id: householdId,
        name: '',
        village: null,
        inviteCode: null,
        createdAt,
        updatedAt: createdAt,
      });

      // Until M2 there is no phone number to bind to. The row exists so that
      // `created_by` is real from the very first expense.
      await db.users.put({
        id: userId,
        householdId,
        phone: '',
        displayName: '',
        role: 'owner',
        createdAt,
      });

      await db.cropCycles.put({
        id: cropCycleId,
        householdId,
        label,
        startsOn,
        endsOn: null,
        isCurrent: true,
      });

      await db.crops.bulkPut(
        SEED_CROPS.map((crop) => ({ id: uuidv7(), householdId, archivedAt: null, ...crop })),
      );

      await db.grades.bulkPut(
        SEED_GRADES.map((g) => ({ id: uuidv7(), householdId, photoUrl: null, ...g })),
      );

      await db.expenseCategories.bulkPut(
        SEED_EXPENSE_CATEGORIES.map((c) => ({ id: uuidv7(), householdId, ...c })),
      );

      await db.fields.bulkPut(
        SEED_FIELDS.map((name, sortOrder) => ({
          id: uuidv7(),
          householdId,
          name,
          areaBigha: null,
          latitude: null,
          longitude: null,
          locationAccuracyM: null,
          sortOrder,
          archivedAt: null,
        })),
      );

      await db.coldStores.put({
        id: uuidv7(),
        householdId,
        name: SEED_COLD_STORE,
        // Per packet per season or per month is still open (§15.5). Not guessed.
        rentPerPacket: null,
        // Everything is assumed to go here unless told otherwise.
        isDefault: true,
        sortOrder: 0,
        archivedAt: null,
      });
    },
  );

  return { householdId, userId, cropCycleId };
}
