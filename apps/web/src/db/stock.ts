/**
 * The stock register and sales against it. Local-first like everything else:
 * nothing here awaits the network (CLAUDE.md §2.1).
 */
import { remainingByGrade, totalHouseholdShare, uuidv7, type GradePackets } from '@kisanmitra/shared';
import { db } from './db.js';
import type { AppContext } from './seed.js';
import type { LocalLot, LocalLotGrade, LocalSale, LocalSaleGrade } from './types.js';

function now(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------- lots */

export interface LotInput {
  /** Exactly as written on paper. Opaque text — nothing is derived from it (§15.1). */
  lotNo: string;
  serialNo: number | null;
  storedOn: string;
  coldStoreId: string | null;
  roomRack: string | null;
  variety: string | null;
  fieldId: string | null;
  notes: string | null;
  cropId: string | null;
  /** Packets per grade. Zero-packet grades are dropped, as the register omits them. */
  packets: GradePackets[];
}

export async function saveLot(
  ctx: AppContext,
  input: LotInput,
  existingId?: string,
): Promise<string> {
  const timestamp = now();
  const id = existingId ?? uuidv7();

  await db.transaction('rw', [db.lots, db.lotGrades], async () => {
    const existing = existingId ? await db.lots.get(existingId) : undefined;

    const lot: LocalLot = {
      id,
      householdId: ctx.householdId,
      cropCycleId: existing?.cropCycleId ?? ctx.cropCycleId,
      coldStoreId: input.coldStoreId,
      cropId: input.cropId,
      lotNo: input.lotNo,
      serialNo: input.serialNo,
      storedOn: input.storedOn,
      roomRack: input.roomRack,
      variety: input.variety,
      fieldId: input.fieldId,
      notes: input.notes,
      createdBy: existing?.createdBy ?? ctx.userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncState: 'pending',
    };
    await db.lots.put(lot);

    // Replace the breakdown wholesale: editing a lot is re-stating what is in
    // it, and a grade removed from the form must disappear from the register.
    const previous = await db.lotGrades.where('lotId').equals(id).toArray();
    await db.lotGrades.bulkDelete(previous.map((row) => row.id));

    const rows: LocalLotGrade[] = input.packets
      .filter((entry) => entry.packets > 0)
      .map((entry) => ({
        id: uuidv7(),
        lotId: id,
        gradeId: entry.gradeId,
        packets: entry.packets,
      }));
    if (rows.length > 0) await db.lotGrades.bulkPut(rows);
  });

  return id;
}

/** Soft delete. The lot and its sales stay (§2.7). */
export async function deleteLot(id: string): Promise<void> {
  const existing = await db.lots.get(id);
  if (!existing) return;
  const timestamp = now();
  await db.lots.put({ ...existing, deletedAt: timestamp, updatedAt: timestamp, syncState: 'pending' });
}

const isLive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null;

export async function listLots(cropCycleId: string): Promise<LocalLot[]> {
  const rows = await db.lots.where('cropCycleId').equals(cropCycleId).filter(isLive).toArray();
  return rows.sort(
    (a, b) => b.storedOn.localeCompare(a.storedOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function getLot(id: string): Promise<LocalLot | undefined> {
  return db.lots.get(id);
}

export function lotGrades(lotId: string): Promise<LocalLotGrade[]> {
  return db.lotGrades.where('lotId').equals(lotId).toArray();
}

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

/* -------------------------------------------------------- what is left */

/** Every grade sold out of a lot, across all its instalments. */
export async function soldPackets(lotId: string): Promise<GradePackets[]> {
  const sales = await listSales(lotId);
  if (sales.length === 0) return [];

  const rows = await db.saleGrades
    .where('saleId')
    .anyOf(sales.map((sale) => sale.id))
    .toArray();

  return rows.map((row) => ({ gradeId: row.gradeId, packets: row.packets }));
}

/** The stock position for one lot: stored, sold and remaining, per grade. */
export async function lotPosition(lotId: string) {
  const [stored, sold] = await Promise.all([
    lotGrades(lotId).then((rows) => rows.map((r) => ({ gradeId: r.gradeId, packets: r.packets }))),
    soldPackets(lotId),
  ]);
  return { stored, sold, remaining: remainingByGrade(stored, sold) };
}

/** Season totals for the home screen: packets in, packets left, money taken. */
export async function stockSummary(cropCycleId: string) {
  const lots = await listLots(cropCycleId);
  let stored = 0;
  let remaining = 0;
  let revenue = 0;

  for (const lot of lots) {
    const position = await lotPosition(lot.id);
    stored += position.stored.reduce((sum, row) => sum + row.packets, 0);
    remaining += position.remaining.reduce((sum, row) => sum + row.remaining, 0);
    for (const sale of await listSales(lot.id)) revenue += sale.totalAmount ?? 0;
  }

  return { lotCount: lots.length, stored, remaining, revenue };
}
