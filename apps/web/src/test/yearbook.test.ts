/**
 * Year books.
 *
 * A khata belongs to the year it was *opened* in, and the farming year turns
 * over in October — so the boundary cases are the whole test. A khata opened in
 * March 2026 belongs with the autumn 2025 planting it is the back half of, not
 * with the calendar year printed on it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from '@kisanmitra/shared';
import { db } from '../db/db.js';
import { saveKhata, settleKhata, yearBooks } from '../db/khata.js';
import type { AppContext } from '../db/seed.js';

const ctx: AppContext = {
  householdId: uuidv7(),
  userId: uuidv7(),
  cropCycleId: uuidv7(),
};

async function khata(name: string, openedOn: string, partners: { name: string; sharePercent: number; isSelf: boolean }[] = []) {
  return saveKhata(ctx, {
    name, cropId: null, fieldId: null, openedOn, durationMonths: null, notes: null, partners,
  });
}

beforeEach(async () => {
  await db.khatas.clear();
  await db.khataPartners.clear();
  await db.expenses.clear();
  await db.sales.clear();
});

describe('which book a khata falls in', () => {
  it('files by the opening date, not the calendar year', async () => {
    await khata('आलू', '2026-03-14'); // spring: still the 2025-26 season
    await khata('गेहूँ', '2025-11-02'); // autumn: also 2025-26

    const books = await yearBooks(ctx.householdId);
    expect(books).toHaveLength(1);
    expect(books[0]!.season).toBe('2025-26');
    expect(books[0]!.khatas.map((k) => k.khata.name).sort()).toEqual(['आलू', 'गेहूँ']);
  });

  it('splits on the turnover in October', async () => {
    await khata('पिछला', '2026-09-30');
    await khata('अगला', '2026-10-01');

    const books = await yearBooks(ctx.householdId);
    expect(books.map((b) => b.season)).toEqual(['2026-27', '2025-26']);
    expect(books.find((b) => b.season === '2025-26')!.khatas[0]!.khata.name).toBe('पिछला');
    expect(books.find((b) => b.season === '2026-27')!.khatas[0]!.khata.name).toBe('अगला');
  });

  it('stores the season on the khata, matching the book it is in', async () => {
    const id = await khata('आलू', '2026-03-14');
    const row = await db.khatas.get(id);
    expect(row!.season).toBe('2025-26');
  });

  it('puts the newest book first', async () => {
    await khata('क', '2024-11-01');
    await khata('ख', '2026-11-01');
    await khata('ग', '2025-11-01');

    expect((await yearBooks(ctx.householdId)).map((b) => b.season)).toEqual([
      '2026-27',
      '2025-26',
      '2024-25',
    ]);
  });

  it('has no books at all before the first khata', async () => {
    expect(await yearBooks(ctx.householdId)).toEqual([]);
  });
});

describe('what a year book totals', () => {
  it('adds up its khatas, in the household\'s own share', async () => {
    const shared = await khata('आलू', '2025-11-01', [
      { name: 'आप', sharePercent: 50, isSelf: true },
      { name: 'राम सिंह', sharePercent: 50, isSelf: false },
    ]);
    const solo = await khata('गेहूँ', '2026-01-10');

    const now = new Date().toISOString();
    await db.expenses.bulkPut([
      { id: uuidv7(), householdId: ctx.householdId, cropCycleId: ctx.cropCycleId, khataId: shared,
        sharingMode: 'khata', categoryId: null, fieldId: null, cropId: null, product: null,
        quantity: null, unit: null, spentOn: '2025-11-05', amount: 4000, vendor: null, notes: null,
        partnerName: null, partnerShare: null, receiptId: null, entryMethod: 'manual',
        createdBy: null, createdAt: now, updatedAt: now, deletedAt: null, status: 'confirmed',
        syncState: 'pending' },
      { id: uuidv7(), householdId: ctx.householdId, cropCycleId: ctx.cropCycleId, khataId: solo,
        sharingMode: 'khata', categoryId: null, fieldId: null, cropId: null, product: null,
        quantity: null, unit: null, spentOn: '2026-01-12', amount: 1000, vendor: null, notes: null,
        partnerName: null, partnerShare: null, receiptId: null, entryMethod: 'manual',
        createdBy: null, createdAt: now, updatedAt: now, deletedAt: null, status: 'confirmed',
        syncState: 'pending' },
    ]);

    const [book] = await yearBooks(ctx.householdId);
    // Half of 4000 from the shared khata, all of 1000 from the solo one.
    expect(book!.expenses).toBe(3000);
    expect(book!.balance).toBe(-3000);
  });

  it('counts what is still running, so a year with loose ends shows it', async () => {
    await khata('क', '2025-11-01');
    const done = await khata('ख', '2025-11-02');
    await settleKhata(done, '2026-04-01');

    const [book] = await yearBooks(ctx.householdId);
    expect(book!.khatas).toHaveLength(2);
    expect(book!.openCount).toBe(1);
  });

  it('reports a fully settled year as having nothing open', async () => {
    const one = await khata('क', '2025-11-01');
    await settleKhata(one, '2026-04-01');

    expect((await yearBooks(ctx.householdId))[0]!.openCount).toBe(0);
  });
});
