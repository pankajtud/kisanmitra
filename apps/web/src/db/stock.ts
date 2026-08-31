/**
 * Sales — of produce, from anywhere.
 *
 * Cold storage is one route a sale can take, not the only one: potato comes out
 * of a lot in instalments, wheat goes straight from the field to the buyer. The
 * stock those lot sales draw down lives in `inventory.ts`.
 */
import { totalHouseholdShare, uuidv7 } from '@kisanmitra/shared';
import { db } from './db.js';
import type { AppContext } from './seed.js';
import type { LocalSale, LocalSaleGrade } from './types.js';

function now(): string {
  return new Date().toISOString();
}

const isLive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null;

/* ------------------------------------------------------------------ sales */

/**
 * A sale is of *produce*, and cold storage is one route it can take. Potato
 * comes out of a graded lot in instalments; wheat and mustard go straight from
 * the field to the buyer and never become a lot at all (CLAUDE.md §1 — nothing
 * potato-specific may be hardcoded).
 *
 * So `lotId` is optional, and a sale carries either per-grade packet lines (a
 * lot sale) or a plain quantity and unit (everything else).
 */
export interface SaleInput {
  soldOn: string;
  buyer: string | null;
  notes: string | null;
  khataId: string | null;
  sharingMode: 'khata' | 'none' | 'custom';
  cropId: string | null;
  fieldId: string | null;
  /** Packets and rate per grade — grades often fetch different rates (§6). Lot sales only. */
  lines: { gradeId: string; packets: number; ratePerPacket: number | null }[];
  /** Quantity sold, for produce that never entered storage. */
  quantity: number | null;
  unit: string | null;
  ratePerUnit: number | null;
  /** Income sharing, mirroring expenses. */
  partnerName: string | null;
  partnerShare: number | null;
}

/** Total for a lot sale: each grade's packets at its own rate. */
export function saleTotal(lines: readonly { packets: number; ratePerPacket: number | null }[]): number {
  return Math.round(
    lines.reduce((sum, line) => sum + line.packets * (line.ratePerPacket ?? 0), 0) * 100,
  ) / 100;
}

export async function saveSale(
  ctx: AppContext,
  lotId: string | null,
  input: SaleInput,
  existingId?: string,
): Promise<string> {
  const timestamp = now();
  const id = existingId ?? uuidv7();
  const lines = lotId ? input.lines.filter((line) => line.packets > 0) : [];

  await db.transaction('rw', [db.sales, db.saleGrades], async () => {
    const existing = existingId ? await db.sales.get(existingId) : undefined;

    // A lot sale is priced per grade; a produce sale is quantity times rate.
    const rates = new Set(lines.map((line) => line.ratePerPacket));
    const blendedRate = lotId
      ? rates.size === 1
        ? [...rates][0]!
        : null
      : input.ratePerUnit;

    const total = lotId
      ? saleTotal(lines)
      : Math.round((input.quantity ?? 0) * (input.ratePerUnit ?? 0) * 100) / 100;

    const sale: LocalSale = {
      id,
      householdId: ctx.householdId,
      cropCycleId: existing?.cropCycleId ?? ctx.cropCycleId,
      lotId,
      khataId: input.khataId,
      sharingMode: input.sharingMode,
      cropId: input.cropId,
      fieldId: input.fieldId,
      soldOn: input.soldOn,
      buyer: input.buyer,
      quantity: lotId ? null : input.quantity,
      unit: lotId ? null : input.unit,
      ratePerPacket: blendedRate,
      totalAmount: total,
      notes: input.notes,
      partnerName: input.partnerName,
      partnerShare: input.partnerShare,
      createdBy: existing?.createdBy ?? ctx.userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncState: 'pending',
    };
    await db.sales.put(sale);

    const previous = await db.saleGrades.where('saleId').equals(id).toArray();
    await db.saleGrades.bulkDelete(previous.map((row) => row.id));

    const rows: LocalSaleGrade[] = lines.map((line) => ({
      id: uuidv7(),
      saleId: id,
      gradeId: line.gradeId,
      packets: line.packets,
      ratePerPacket: line.ratePerPacket,
    }));
    if (rows.length > 0) await db.saleGrades.bulkPut(rows);
  });

  return id;
}

export async function deleteSale(id: string): Promise<void> {
  const existing = await db.sales.get(id);
  if (!existing) return;
  const timestamp = now();
  await db.sales.put({ ...existing, deletedAt: timestamp, updatedAt: timestamp, syncState: 'pending' });
}

/** Sales out of one cold-storage lot. */
export async function listSales(lotId: string): Promise<LocalSale[]> {
  const rows = await db.sales.where('lotId').equals(lotId).filter(isLive).toArray();
  return rows.sort((a, b) => b.soldOn.localeCompare(a.soldOn));
}

/** Every sale in the season, lot-based or not. */
export async function listSeasonSales(cropCycleId: string): Promise<LocalSale[]> {
  const rows = await db.sales.where('cropCycleId').equals(cropCycleId).filter(isLive).toArray();
  return rows.sort(
    (a, b) => b.soldOn.localeCompare(a.soldOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * What the season earned *this household*.
 *
 * `total` nets off any partner's cut, the same way the expense side does —
 * a crop grown in partnership splits both the cost and the income, and only
 * the household's own half belongs in its books.
 */
export async function seasonIncome(cropCycleId: string) {
  const sales = await listSeasonSales(cropCycleId);
  return {
    total: totalHouseholdShare(
      sales.map((sale) => ({ amount: sale.totalAmount, partnerShare: sale.partnerShare })),
    ),
    billed: sales.reduce((sum, sale) => sum + (sale.totalAmount ?? 0), 0),
    count: sales.length,
  };
}

/** Buyer names used before, for the autocomplete. */
export async function knownBuyers(householdId: string): Promise<string[]> {
  const rows = await db.sales.where('householdId').equals(householdId).toArray();
  const seen = new Map<string, string>();
  for (const row of rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const name = row.buyer?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}

export function getSale(id: string): Promise<LocalSale | undefined> {
  return db.sales.get(id);
}

export function saleGradeRows(saleId: string): Promise<LocalSaleGrade[]> {
  return db.saleGrades.where('saleId').equals(saleId).toArray();
}
