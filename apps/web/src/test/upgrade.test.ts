/**
 * Upgrading a database that already has data in it.
 *
 * Every other test starts from an empty database, which is the one situation a
 * real phone is never in. A farmer who has been using the app has a schema from
 * whatever version they last loaded, and Dexie runs the upgrades in order the
 * next time they open it. If any of them throws, `ensureSeeded` rejects, the
 * app context never resolves, and the screen goes white with nothing on it.
 */
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from '@kisanmitra/shared';
import { KisanMitraDb } from '../db/db.js';
import { ensureSeeded } from '../db/seed.js';

const NAME = 'upgrade-test';

async function wipe() {
  await Dexie.delete(NAME);
}

/** The schema as version 1 shipped it, with a household's real records in it. */
async function seedV1() {
  const old = new Dexie(NAME);
  old.version(1).stores({
    households: 'id',
    users: 'id, householdId',
    cropCycles: 'id, householdId, isCurrent',
    fields: 'id, householdId, sortOrder',
    grades: 'id, householdId, sortOrder',
    coldStores: 'id, householdId',
    expenseCategories: 'id, householdId, sortOrder',
    expenses: 'id, householdId, cropCycleId, [cropCycleId+spentOn], categoryId, syncState, status',
    receipts: 'id, householdId, photoHash, syncState, extractionStatus',
    photos: 'receiptId, uploadedAt',
  });
  await old.open();

  const householdId = uuidv7();
  const cropCycleId = uuidv7();
  const userId = uuidv7();
  const now = new Date().toISOString();

  await old.table('households').put({ id: householdId, name: '', village: null, createdAt: now });
  await old.table('users').put({
    id: userId, householdId, phone: '', displayName: '', role: 'owner', createdAt: now,
  });
  await old.table('cropCycles').put({
    id: cropCycleId, householdId, label: '2025-26', startsOn: '2025-10-01',
    endsOn: null, isCurrent: true,
  });
  await old.table('expenseCategories').put({
    id: uuidv7(), householdId, key: 'seed', labelHi: 'बीज', labelEn: 'Seed', icon: 'seed', sortOrder: 0,
  });
  await old.table('fields').put({
    id: uuidv7(), householdId, name: 'Jaynagar', areaBigha: null, sortOrder: 0, archivedAt: null,
  });
  await old.table('coldStores').put({
    id: uuidv7(), householdId, name: 'G.L. Cold Storage, Chitaura', rentPerPacket: null,
  });

  // An expense written before sharing modes, khatas or crops existed.
  await old.table('expenses').put({
    id: uuidv7(), householdId, cropCycleId, categoryId: null, fieldId: null,
    spentOn: '2026-02-27', amount: 4500, vendor: 'दुकान', notes: null,
    receiptId: null, entryMethod: 'manual', createdBy: userId,
    createdAt: now, updatedAt: now, deletedAt: null, status: 'confirmed', syncState: 'pending',
  });

  old.close();
  return { householdId, cropCycleId };
}

beforeEach(wipe);

describe('opening a database written by an older version', () => {
  it('upgrades from v1 without losing the records in it', async () => {
    const { householdId } = await seedV1();

    const db = new KisanMitraDb(NAME);
    await db.open();

    expect(db.verno).toBeGreaterThanOrEqual(6);
    const expenses = await db.table('expenses').toArray();
    expect(expenses).toHaveLength(1);
    expect(expenses[0]!.amount).toBe(4500);
    expect(expenses[0]!.vendor).toBe('दुकान');

    // The v4 upgrade gives pre-existing rows the default sharing mode, so old
    // totals do not move.
    expect(expenses[0]!.sharingMode).toBe('khata');

    // Tables added along the way exist and are empty, not missing.
    expect(await db.table('khatas').count()).toBe(0);
    expect(await db.table('inventoryEntries').count()).toBe(0);
    expect(await db.table('crops').count()).toBe(0);

    expect((await db.table('households').toArray())[0]!.id).toBe(householdId);
    db.close();
  });

  it('lets the app boot on it — the step that blanks the screen when it fails', async () => {
    await seedV1();

    const db = new KisanMitraDb(NAME);
    await db.open();

    // ensureSeeded runs against the module-level `db`, so this asserts the
    // upgraded schema supports every query it makes.
    await expect(
      (async () => {
        const household = await db.table('households').toCollection().first();
        const user = await db.table('users').where('householdId').equals(household!.id).first();
        const cycle = await db.table('cropCycles').where('householdId').equals(household!.id).first();
        return { household, user, cycle };
      })(),
    ).resolves.toMatchObject({ household: expect.anything(), user: expect.anything() });

    db.close();
  });

  it('indexes the new keys on tables that already held rows', async () => {
    await seedV1();
    const db = new KisanMitraDb(NAME);
    await db.open();

    // These queries throw on a table whose index was not rebuilt during upgrade.
    await expect(db.table('expenses').where('khataId').equals('x').count()).resolves.toBe(0);
    await expect(db.table('expenses').where('fieldId').equals('x').count()).resolves.toBe(0);
    await expect(db.table('sales').where('khataId').equals('x').count()).resolves.toBe(0);

    db.close();
  });
});

describe('a fresh install', () => {
  it('seeds and boots', async () => {
    const ctx = await ensureSeeded();
    expect(ctx.householdId).toBeTruthy();
    expect(ctx.cropCycleId).toBeTruthy();
  });
});

describe('lots stranded by the v4 restructure', () => {
  it('are given the consignment they belong to, rather than vanishing', async () => {
    // A lot written by v3, when a lot *was* the consignment and carried the
    // cold store, crop and date itself.
    const old = new Dexie(NAME);
    old.version(3).stores({
      households: 'id',
      lots: 'id, householdId, cropCycleId, [cropCycleId+storedOn], coldStoreId, fieldId, lotNo, syncState',
      lotGrades: 'id, lotId, gradeId, [lotId+gradeId]',
    });
    await old.open();

    const householdId = uuidv7();
    const lotId = uuidv7();
    const now = new Date().toISOString();
    await old.table('households').put({ id: householdId, name: '', village: null, createdAt: now });
    await old.table('lots').put({
      id: lotId, householdId, cropCycleId: uuidv7(), coldStoreId: uuidv7(), cropId: null,
      lotNo: '91/251', serialNo: null, storedOn: '2026-03-14', roomRack: '2/14',
      variety: '37-97', fieldId: null, notes: null, createdBy: null,
      createdAt: now, updatedAt: now, deletedAt: null, syncState: 'pending',
    });
    old.close();

    const db = new KisanMitraDb(NAME);
    await db.open();

    const lot = await db.table('lots').get(lotId);
    expect(lot.entryId).toBeTruthy();

    // The columns that moved up went with it.
    const entry = await db.table('inventoryEntries').get(lot.entryId);
    expect(entry).toBeDefined();
    expect(entry.storedOn).toBe('2026-03-14');
    expect(entry.variety).toBe('37-97');
    expect(entry.householdId).toBe(householdId);

    // And the lot keeps what belongs to a lot.
    expect(lot.lotNo).toBe('91/251');
    expect(lot.roomRack).toBe('2/14');

    db.close();
  });
});
