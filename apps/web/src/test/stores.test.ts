/**
 * Cold stores. Produce goes to the default unless said otherwise, and a store
 * is archived rather than deleted because consignments point at it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db.js';
import {
  addColdStore,
  archiveColdStore,
  coldStoreUsage,
  defaultColdStore,
  listColdStores,
  makeDefaultColdStore,
  renameColdStore,
  restoreColdStore,
} from '../db/coldStores.js';
import { saveEntry } from '../db/inventory.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';

let ctx: AppContext;
beforeEach(async () => {
  ctx = await ensureSeeded();
});

describe('cold stores', () => {
  it('seeds G.L. as the default', async () => {
    const store = await defaultColdStore(ctx.householdId);
    expect(store!.name).toBe('G.L. Cold Storage, Chitaura');
    expect(store!.isDefault).toBe(true);
  });

  it('adds another without disturbing the default', async () => {
    await addColdStore(ctx.householdId, 'Sharma Cold Storage');

    const stores = await listColdStores(ctx.householdId);
    expect(stores).toHaveLength(2);
    expect((await defaultColdStore(ctx.householdId))!.name).toBe('G.L. Cold Storage, Chitaura');
    // The default sorts first, so it is the obvious choice on a picker.
    expect(stores[0]!.isDefault).toBe(true);
  });

  it('moves the default when asked', async () => {
    const other = (await addColdStore(ctx.householdId, 'Sharma Cold Storage'))!;
    await makeDefaultColdStore(ctx.householdId, other);

    expect((await defaultColdStore(ctx.householdId))!.id).toBe(other);
    // Exactly one default, always.
    expect((await listColdStores(ctx.householdId)).filter((s) => s.isDefault)).toHaveLength(1);
  });

  it('does not create a twin for a name already there', async () => {
    const first = await addColdStore(ctx.householdId, 'Sharma Cold Storage');
    const again = await addColdStore(ctx.householdId, '  sharma cold storage  ');
    expect(again).toBe(first);
    expect(await listColdStores(ctx.householdId)).toHaveLength(2);
  });

  it('archives rather than deletes, and keeps the row', async () => {
    const other = (await addColdStore(ctx.householdId, 'Sharma Cold Storage'))!;
    await archiveColdStore(other);

    expect((await listColdStores(ctx.householdId)).map((s) => s.id)).not.toContain(other);
    expect(await db.coldStores.get(other)).toBeDefined();
    expect((await listColdStores(ctx.householdId, true)).map((s) => s.id)).toContain(other);
  });

  it('hands the default to someone else if the default is archived', async () => {
    const other = (await addColdStore(ctx.householdId, 'Sharma Cold Storage'))!;
    const gl = (await defaultColdStore(ctx.householdId))!;
    await archiveColdStore(gl.id);

    // A household must always have somewhere produce goes by default.
    expect((await defaultColdStore(ctx.householdId))!.id).toBe(other);
  });

  it('brings an archived store back by name', async () => {
    const other = (await addColdStore(ctx.householdId, 'Sharma Cold Storage'))!;
    await archiveColdStore(other);
    expect(await addColdStore(ctx.householdId, 'Sharma Cold Storage')).toBe(other);
  });

  it('restores one directly', async () => {
    const other = (await addColdStore(ctx.householdId, 'Sharma'))!;
    await archiveColdStore(other);
    await restoreColdStore(other);
    expect((await listColdStores(ctx.householdId)).map((s) => s.id)).toContain(other);
  });

  it('renames in place', async () => {
    const id = (await defaultColdStore(ctx.householdId))!.id;
    await renameColdStore(id, 'G.L. Cold Storage');
    expect((await db.coldStores.get(id))!.name).toBe('G.L. Cold Storage');
  });

  it('counts the consignments pointing at a store', async () => {
    const store = (await defaultColdStore(ctx.householdId))!;
    const grades = await db.grades.where('householdId').equals(ctx.householdId).toArray();

    await saveEntry(ctx, {
      khataId: null, cropId: null, coldStoreId: store.id, storedOn: '2026-03-14',
      variety: null, fieldId: null, notes: null,
      lots: [{ lotNo: '91/251', roomRack: null, packets: [{ gradeId: grades[0]!.id, packets: 10 }] }],
    });

    expect(await coldStoreUsage(store.id)).toBe(1);
  });
});
