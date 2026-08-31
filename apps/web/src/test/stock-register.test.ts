/**
 * The stock register: one row per lot, gathered into a book per year, with the
 * colour status that tells a farmer at a glance what is left.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db.js';
import { saveEntry, stockYearBooks } from '../db/inventory.js';
import { saveSale } from '../db/stock.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';

let ctx: AppContext;
let grades: { id: string; code: string; sortOrder: number }[];

beforeEach(async () => {
  ctx = await ensureSeeded();
  grades = (await db.grades.where('householdId').equals(ctx.householdId).toArray()).map((g) => ({
    id: g.id,
    code: g.code,
    sortOrder: g.sortOrder,
  }));
});

const M = () => grades.find((g) => g.code === 'M')!.id;
const G = () => grades.find((g) => g.code === 'G')!.id;

async function entry(storedOn: string, lots: { lotNo: string; packets: number; gradeId?: string }[]) {
  return saveEntry(ctx, {
    khataId: null, cropId: null, coldStoreId: null, storedOn,
    variety: '37-97', fieldId: null, notes: null,
    lots: lots.map((l) => ({
      lotNo: l.lotNo,
      roomRack: '2/14',
      packets: [{ gradeId: l.gradeId ?? M(), packets: l.packets }],
    })),
  });
}

describe('the register', () => {
  it('writes one row per lot, not per consignment', async () => {
    await entry('2026-03-14', [{ lotNo: '91/251', packets: 100 }, { lotNo: '95/71', packets: 71 }]);

    const [book] = await stockYearBooks(ctx.householdId, grades);
    expect(book!.entryCount).toBe(1);
    expect(book!.rows).toHaveLength(2);
    expect(book!.rows.map((r) => r.lot.lotNo).sort()).toEqual(['91/251', '95/71']);
  });

  it('files by the day produce went in, so spring joins the autumn before it', async () => {
    await entry('2026-03-14', [{ lotNo: 'A', packets: 10 }]);
    await entry('2025-11-02', [{ lotNo: 'B', packets: 20 }]);
    await entry('2026-11-02', [{ lotNo: 'C', packets: 30 }]);

    const books = await stockYearBooks(ctx.householdId, grades);
    expect(books.map((b) => b.season)).toEqual(['2026-27', '2025-26']);
    expect(books.find((b) => b.season === '2025-26')!.rows.map((r) => r.lot.lotNo).sort()).toEqual([
      'A',
      'B',
    ]);
  });

  it('colours a lot by how much of it is left', async () => {
    const id = await entry('2026-03-14', [{ lotNo: '91/251', packets: 100 }]);
    const lots = await db.lots.where('entryId').equals(id).toArray();

    // Nothing sold yet.
    let [book] = await stockYearBooks(ctx.householdId, grades);
    expect(book!.rows[0]!.status).toBe('full');

    await saveSale(ctx, lots[0]!.id, {
      soldOn: '2026-04-01', buyer: null, notes: null, khataId: null, sharingMode: 'khata',
      cropId: null, fieldId: null, lines: [{ gradeId: M(), packets: 40, ratePerPacket: 900 }],
      quantity: null, unit: null, ratePerUnit: null, partnerName: null, partnerShare: null,
    });

    [book] = await stockYearBooks(ctx.householdId, grades);
    expect(book!.rows[0]!.status).toBe('partial');
    expect(book!.rows[0]!.remaining).toBe(60);
    expect(book!.rows[0]!.sold).toBe(40);

    await saveSale(ctx, lots[0]!.id, {
      soldOn: '2026-05-01', buyer: null, notes: null, khataId: null, sharingMode: 'khata',
      cropId: null, fieldId: null, lines: [{ gradeId: M(), packets: 60, ratePerPacket: 900 }],
      quantity: null, unit: null, ratePerUnit: null, partnerName: null, partnerShare: null,
    });

    [book] = await stockYearBooks(ctx.householdId, grades);
    expect(book!.rows[0]!.status).toBe('soldOut');
    expect(book!.rows[0]!.remaining).toBe(0);
  });

  it('shows what remains in the register notation', async () => {
    await entry('2026-03-14', [
      { lotNo: '91/251', packets: 10 },
      { lotNo: '91/252', packets: 83, gradeId: G() },
    ]);

    const [book] = await stockYearBooks(ctx.householdId, grades);
    const row = book!.rows.find((r) => r.lot.lotNo === '91/251')!;
    expect(row.breakdown).toEqual([{ code: 'M', packets: 10, sortOrder: 0 }]);
  });

  it('totals a year across its consignments', async () => {
    await entry('2026-03-14', [{ lotNo: 'A', packets: 100 }]);
    await entry('2026-03-20', [{ lotNo: 'B', packets: 50 }]);

    const [book] = await stockYearBooks(ctx.householdId, grades);
    expect(book!.stored).toBe(150);
    expect(book!.remaining).toBe(150);
    expect(book!.entryCount).toBe(2);
  });

  it('leaves a deleted consignment out', async () => {
    const id = await entry('2026-03-14', [{ lotNo: 'A', packets: 10 }]);
    const { deleteEntry } = await import('../db/inventory.js');
    await deleteEntry(id);

    expect(await stockYearBooks(ctx.householdId, grades)).toEqual([]);
  });

  it('has no books before anything is stored', async () => {
    expect(await stockYearBooks(ctx.householdId, grades)).toEqual([]);
  });
});
