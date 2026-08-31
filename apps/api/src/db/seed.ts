/**
 * Seed data for one household (CLAUDE.md §13, M0). Idempotent — safe to re-run.
 *
 * Everything seeded here is *reference data the household can edit*. The potato
 * values are a starting point, not a hardcoded assumption (§1).
 */
import { eq } from 'drizzle-orm';
import {
  SEED_COLD_STORE,
  SEED_CROPS,
  SEED_EXPENSE_CATEGORIES,
  SEED_FIELDS,
  SEED_GRADES,
  uuidv7,
} from '@kisanmitra/shared';
import { db, schema, sql } from './client.js';

const HOUSEHOLD = { name: 'Upadhyay', village: 'Chitaura' };
const DEV_USER = { phone: '+915550000001', displayName: 'Pankaj', role: 'owner' };
const CROP_CYCLE = { label: '2025-26', startsOn: '2025-10-01' };

async function main() {
  const existing = await db
    .select()
    .from(schema.households)
    .where(eq(schema.households.name, HOUSEHOLD.name))
    .limit(1);

  if (existing[0]) {
    const householdId = existing[0].id;
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.householdId, householdId))
      .limit(1);

    // Reference data introduced after this household was first seeded has to be
    // backfilled, or re-running the seed leaves it silently missing.
    const crops = await db
      .select()
      .from(schema.crops)
      .where(eq(schema.crops.householdId, householdId))
      .limit(1);
    if (!crops[0]) {
      await db
        .insert(schema.crops)
        .values(SEED_CROPS.map((crop) => ({ id: uuidv7(), householdId, ...crop })));
      console.log('backfilled crops');
    }

    report(householdId, user[0]?.id ?? '(none)');
    return;
  }

  const householdId = uuidv7();
  const userId = uuidv7();
  const cropCycleId = uuidv7();

  await db.transaction(async (tx) => {
    await tx.insert(schema.households).values({ id: householdId, ...HOUSEHOLD });

    await tx.insert(schema.users).values({ id: userId, householdId, ...DEV_USER });

    await tx.insert(schema.cropCycles).values({
      id: cropCycleId,
      householdId,
      ...CROP_CYCLE,
      isCurrent: true,
    });

    await tx.insert(schema.crops).values(
      SEED_CROPS.map((crop) => ({ id: uuidv7(), householdId, ...crop })),
    );

    await tx.insert(schema.grades).values(
      SEED_GRADES.map((g) => ({ id: uuidv7(), householdId, ...g })),
    );

    await tx.insert(schema.expenseCategories).values(
      SEED_EXPENSE_CATEGORIES.map((c) => ({ id: uuidv7(), householdId, ...c })),
    );

    await tx.insert(schema.fields).values(
      SEED_FIELDS.map((name, sortOrder) => ({ id: uuidv7(), householdId, name, sortOrder })),
    );

    await tx.insert(schema.coldStores).values({
      id: uuidv7(),
      householdId,
      name: SEED_COLD_STORE,
      // Rent per packet is unknown, and whether it is per season or per month
      // is open (CLAUDE.md §15.5). Left null rather than guessed.
      rentPerPacket: null,
    });
  });

  report(householdId, userId);
}

function report(householdId: string, userId: string) {
  console.log('seeded household', householdId);
  console.log('');
  console.log('Add these to apps/api/.env — M0 has no auth and runs as this user:');
  console.log(`DEV_HOUSEHOLD_ID=${householdId}`);
  console.log(`DEV_USER_ID=${userId}`);
}

await main();
await sql.end();
