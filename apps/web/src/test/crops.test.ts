/**
 * Reconciling the seeded crop list.
 *
 * Removing a crop from the seed must never remove it from a household that has
 * records against it — an expense pointing at a deleted crop would lose the
 * record of what the money was spent on (CLAUDE.md §2.7).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_CROPS, uuidv7 } from '@kisanmitra/shared';
import { db } from '../db/db.js';
import { addCrop, listCrops, reconcileCrops } from '../db/crops.js';

const HOUSEHOLD = uuidv7();

/** The list as an earlier version seeded it. */
const OLD_SEED = [
  { nameHi: 'आलू', nameEn: 'Potato', defaultUnit: 'बोरा', usesColdStorage: true, defaultDurationMonths: 5, sortOrder: 0 },
  { nameHi: 'सरसों', nameEn: 'Mustard', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 5, sortOrder: 1 },
  { nameHi: 'गन्ना', nameEn: 'Sugarcane', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 12, sortOrder: 2 },
];

beforeEach(async () => {
  await reconcileCrops(HOUSEHOLD, OLD_SEED);
});

describe('reconcileCrops', () => {
  it('adds the crops the household now grows', async () => {
    await reconcileCrops(HOUSEHOLD, SEED_CROPS);
    const names = (await listCrops(HOUSEHOLD)).map((c) => c.nameHi);

    expect(names).toEqual(SEED_CROPS.map((c) => c.nameHi));
    expect(names).toContain('शिमला मिर्च');
    expect(names).toContain('कशीफल');
  });

  it('archives a dropped crop instead of deleting it', async () => {
    const before = (await db.crops.where('householdId').equals(HOUSEHOLD).toArray()).find(
      (c) => c.nameHi === 'सरसों',
    )!;

    await reconcileCrops(HOUSEHOLD, SEED_CROPS);

    // Gone from every picker...
    expect((await listCrops(HOUSEHOLD)).map((c) => c.nameHi)).not.toContain('सरसों');

    // ...but the row is still there, with the same id, so an expense recorded
    // against it still resolves its name.
    const after = await db.crops.get(before.id);
    expect(after).toBeDefined();
    expect(after!.archivedAt).not.toBeNull();
    expect((await listCrops(HOUSEHOLD, true)).map((c) => c.nameHi)).toContain('सरसों');
  });

  it('leaves a crop the household added themselves alone', async () => {
    await addCrop(HOUSEHOLD, { nameHi: 'लहसुन' });
    await reconcileCrops(HOUSEHOLD, SEED_CROPS);

    // The seed is a starting point, not a whitelist.
    expect((await listCrops(HOUSEHOLD)).map((c) => c.nameHi)).toContain('लहसुन');
  });

  it('keeps a crop that survives the change, with the same id', async () => {
    const before = (await listCrops(HOUSEHOLD)).find((c) => c.nameHi === 'आलू')!;
    await reconcileCrops(HOUSEHOLD, SEED_CROPS);
    const after = (await listCrops(HOUSEHOLD)).find((c) => c.nameHi === 'आलू')!;

    expect(after.id).toBe(before.id);
    expect(after.usesColdStorage).toBe(true);
  });

  it('is idempotent', async () => {
    await reconcileCrops(HOUSEHOLD, SEED_CROPS);
    const first = await listCrops(HOUSEHOLD);
    await reconcileCrops(HOUSEHOLD, SEED_CROPS);
    const second = await listCrops(HOUSEHOLD);

    expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id));
  });

  it('never un-archives something the household hid on purpose', async () => {
    await reconcileCrops(HOUSEHOLD, SEED_CROPS);
    const potato = (await listCrops(HOUSEHOLD)).find((c) => c.nameHi === 'आलू')!;
    await db.crops.put({ ...potato, archivedAt: new Date().toISOString() });

    await reconcileCrops(HOUSEHOLD, SEED_CROPS);
    expect((await listCrops(HOUSEHOLD)).map((c) => c.nameHi)).not.toContain('आलू');
  });
});

describe('the seeded list', () => {
  it('is exactly the twelve crops this household grows', async () => {
    expect(SEED_CROPS.map((c) => c.nameEn)).toEqual([
      'Deshi Mirch', 'Shimla Mirch', 'Kheera', 'Gobhi', 'Kharbooja', 'Tarbooj',
      'Arabi', 'Kashifal', 'Petha', 'Aloo', 'Bajra', 'Gehoon',
    ]);
  });

  it('sends only potato to cold storage', () => {
    expect(SEED_CROPS.filter((c) => c.usesColdStorage).map((c) => c.nameHi)).toEqual(['आलू']);
  });
});
