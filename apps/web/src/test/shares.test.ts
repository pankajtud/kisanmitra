/**
 * An entry on the default sharing mode inherits its khata's agreed split. That
 * means a season total cannot be computed from the rows alone — it has to know
 * the partners of every khata involved.
 *
 * This regressed once: the totals read `partner_share` off the row, which is
 * null for an inherited split, so a half-shared expense counted in full.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from '@kisanmitra/shared';
import { db } from '../db/db.js';
import { partnersByKhata, shareOf, sumShares } from '../db/shares.js';

const HOUSEHOLD = uuidv7();
const SHARED = uuidv7();
const SOLO = uuidv7();

beforeEach(async () => {
  await db.khatas.bulkPut([
    {
      id: SHARED, householdId: HOUSEHOLD, cropCycleId: null, cropId: null,
      name: 'आलू', openedOn: '2025-10-01', status: 'open', settledOn: null, notes: null,
      createdBy: null, createdAt: '', updatedAt: '', deletedAt: null, syncState: 'pending',
    },
    {
      id: SOLO, householdId: HOUSEHOLD, cropCycleId: null, cropId: null,
      name: 'गेहूं', openedOn: '2025-10-01', status: 'open', settledOn: null, notes: null,
      createdBy: null, createdAt: '', updatedAt: '', deletedAt: null, syncState: 'pending',
    },
  ]);
  await db.khataPartners.bulkPut([
    { id: uuidv7(), khataId: SHARED, name: 'आप', sharePercent: 50, isSelf: true, sortOrder: 0 },
    { id: uuidv7(), khataId: SHARED, name: 'राम सिंह', sharePercent: 50, isSelf: false, sortOrder: 1 },
  ]);
});

describe('khata-aware shares', () => {
  it('halves an inherited entry even though the row carries no partner share', async () => {
    const partners = await partnersByKhata(HOUSEHOLD);
    expect(
      shareOf(
        { khataId: SHARED, amount: 4500, sharingMode: 'khata', partnerShare: null },
        partners,
      ),
    ).toBe(2250);
  });

  it('leaves an entry in an unshared khata whole', async () => {
    const partners = await partnersByKhata(HOUSEHOLD);
    expect(
      shareOf({ khataId: SOLO, amount: 4500, sharingMode: 'khata', partnerShare: null }, partners),
    ).toBe(4500);
  });

  it('leaves an entry with no khata whole', async () => {
    const partners = await partnersByKhata(HOUSEHOLD);
    expect(
      shareOf({ khataId: null, amount: 4500, sharingMode: 'khata', partnerShare: null }, partners),
    ).toBe(4500);
  });

  it('lets an entry override the agreement', async () => {
    const partners = await partnersByKhata(HOUSEHOLD);

    // Paid alone, inside a shared khata.
    expect(
      shareOf({ khataId: SHARED, amount: 1000, sharingMode: 'none', partnerShare: null }, partners),
    ).toBe(1000);

    // Split differently in rupees, because that is how the receipt fell.
    expect(
      shareOf({ khataId: SHARED, amount: 1000, sharingMode: 'custom', partnerShare: 250 }, partners),
    ).toBe(750);
  });

  it('totals a season across khatas with different agreements', async () => {
    const partners = await partnersByKhata(HOUSEHOLD);
    const total = sumShares(
      [
        { khataId: SHARED, amount: 4500, sharingMode: 'khata', partnerShare: null }, // 2250
        { khataId: SHARED, amount: 1000, sharingMode: 'none', partnerShare: null }, //  1000
        { khataId: SOLO, amount: 2000, sharingMode: 'khata', partnerShare: null }, //   2000
        { khataId: null, amount: 500, sharingMode: 'khata', partnerShare: null }, //     500
      ],
      partners,
    );
    expect(total).toBe(5750);
  });

  it('reads partners for a household with no khatas at all', async () => {
    const partners = await partnersByKhata(uuidv7());
    expect(partners.size).toBe(0);
    expect(sumShares([{ khataId: null, amount: 100, sharingMode: 'khata', partnerShare: null }], partners)).toBe(100);
  });
});
