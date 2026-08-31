/**
 * Inventory: what is in storage, where it is, and what has been sold out of it.
 *
 * An **entry** is one consignment put into storage and belongs to exactly one
 * cold store — that invariant is why the table exists. Inside that store it can
 * occupy several **lots**, each a numbered place holding a grade breakdown.
 * Sales are recorded against a lot.
 */
import { remainingByGrade, uuidv7, type GradePackets } from '@kisanmitra/shared';
import { db } from './db.js';
import type { AppContext } from './seed.js';
import type { LocalInventoryEntry, LocalLot, LocalLotGrade } from './types.js';

function now(): string {
  return new Date().toISOString();
}

const isLive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null;

export interface LotInput {
  /** Existing lot id when editing, so its sales stay attached. */
  id?: string;
  /** The number written on the register — a place inside the cold store. */
  lotNo: string;
  roomRack: string | null;
  packets: GradePackets[];
}

export interface EntryInput {
  khataId: string | null;
  cropId: string | null;
  /** Exactly one cold store per entry. */
  coldStoreId: string | null;
  storedOn: string;
  variety: string | null;
  fieldId: string | null;
  notes: string | null;
  lots: LotInput[];
}

export async function saveEntry(
  ctx: AppContext,
  input: EntryInput,
  existingId?: string,
): Promise<string> {
  const timestamp = now();
  const id = existingId ?? uuidv7();

  await db.transaction('rw', [db.inventoryEntries, db.lots, db.lotGrades], async () => {
    const existing = existingId ? await db.inventoryEntries.get(existingId) : undefined;

    const entry: LocalInventoryEntry = {
      id,
      householdId: ctx.householdId,
      cropCycleId: existing?.cropCycleId ?? ctx.cropCycleId,
      khataId: input.khataId,
      cropId: input.cropId,
      coldStoreId: input.coldStoreId,
      storedOn: input.storedOn,
      variety: input.variety,
      fieldId: input.fieldId,
      notes: input.notes,
      createdBy: existing?.createdBy ?? ctx.userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncState: 'pending',
    };
    await db.inventoryEntries.put(entry);

    const kept = new Set(input.lots.map((lot) => lot.id).filter(Boolean) as string[]);
    const previous = await db.lots.where('entryId').equals(id).toArray();

    // A lot dropped from the form is soft-deleted, never removed: sales may
    // point at it, and nothing is ever truly deleted (CLAUDE.md §2.7).
    for (const lot of previous) {
      if (!kept.has(lot.id)) {
        await db.lots.put({ ...lot, deletedAt: timestamp, updatedAt: timestamp, syncState: 'pending' });
      }
    }

    for (const lotInput of input.lots) {
      const lotId = lotInput.id ?? uuidv7();
      const before = lotInput.id ? previous.find((l) => l.id === lotInput.id) : undefined;

      const lot: LocalLot = {
        id: lotId,
        householdId: ctx.householdId,
        entryId: id,
        lotNo: lotInput.lotNo,
        serialNo: before?.serialNo ?? null,
        roomRack: lotInput.roomRack,
        notes: before?.notes ?? null,
        createdBy: before?.createdBy ?? ctx.userId,
        createdAt: before?.createdAt ?? timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        syncState: 'pending',
      };
      await db.lots.put(lot);

      const oldGrades = await db.lotGrades.where('lotId').equals(lotId).toArray();
      await db.lotGrades.bulkDelete(oldGrades.map((row) => row.id));

      const rows: LocalLotGrade[] = lotInput.packets
        .filter((entry) => entry.packets > 0)
        .map((entry) => ({ id: uuidv7(), lotId, gradeId: entry.gradeId, packets: entry.packets }));
      if (rows.length > 0) await db.lotGrades.bulkPut(rows);
    }
  });

  return id;
}

export async function deleteEntry(id: string): Promise<void> {
  const existing = await db.inventoryEntries.get(id);
  if (!existing) return;
  const timestamp = now();
  await db.inventoryEntries.put({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    syncState: 'pending',
  });
}

export function getEntry(id: string): Promise<LocalInventoryEntry | undefined> {
  return db.inventoryEntries.get(id);
}

export async function listEntries(cropCycleId: string): Promise<LocalInventoryEntry[]> {
  const rows = await db.inventoryEntries
    .where('cropCycleId')
    .equals(cropCycleId)
    .filter(isLive)
    .toArray();
  return rows.sort(
    (a, b) => b.storedOn.localeCompare(a.storedOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function entryLots(entryId: string): Promise<LocalLot[]> {
  const rows = await db.lots.where('entryId').equals(entryId).filter(isLive).toArray();
  return rows.sort((a, b) => a.lotNo.localeCompare(b.lotNo, undefined, { numeric: true }));
}

export function getLot(id: string): Promise<LocalLot | undefined> {
  return db.lots.get(id);
}

export function lotGrades(lotId: string): Promise<LocalLotGrade[]> {
  return db.lotGrades.where('lotId').equals(lotId).toArray();
}

/** Packets sold out of one lot, across every instalment. */
export async function soldFromLot(lotId: string): Promise<GradePackets[]> {
  const sales = await db.sales.where('lotId').equals(lotId).filter(isLive).toArray();
  if (sales.length === 0) return [];
  const rows = await db.saleGrades.where('saleId').anyOf(sales.map((s) => s.id)).toArray();
  return rows.map((row) => ({ gradeId: row.gradeId, packets: row.packets }));
}

/** Stored, sold and remaining per grade, for one lot. */
export async function lotPosition(lotId: string) {
  const [stored, sold] = await Promise.all([
    lotGrades(lotId).then((rows) => rows.map((r) => ({ gradeId: r.gradeId, packets: r.packets }))),
    soldFromLot(lotId),
  ]);
  return { stored, sold, remaining: remainingByGrade(stored, sold) };
}

/** The same, summed across every lot in an entry. */
export async function entryPosition(entryId: string) {
  const lots = await entryLots(entryId);
  const stored: GradePackets[] = [];
  const sold: GradePackets[] = [];

  for (const lot of lots) {
    const position = await lotPosition(lot.id);
    stored.push(...position.stored);
    sold.push(...position.sold);
  }

  return { lots, stored, sold, remaining: remainingByGrade(stored, sold) };
}

/** Season totals for the home screen. */
export async function inventorySummary(cropCycleId: string) {
  const entries = await listEntries(cropCycleId);
  let stored = 0;
  let remaining = 0;
  let lotCount = 0;

  for (const entry of entries) {
    const position = await entryPosition(entry.id);
    lotCount += position.lots.length;
    stored += position.stored.reduce((sum, row) => sum + row.packets, 0);
    remaining += position.remaining.reduce((sum, row) => sum + row.remaining, 0);
  }

  return { entryCount: entries.length, lotCount, stored, remaining };
}

export interface AvailableLot {
  lot: LocalLot;
  entry: LocalInventoryEntry;
  /** Packets still in this lot, per grade. */
  remaining: { gradeId: string; remaining: number }[];
  total: number;
}

/**
 * Every lot with packets still in it, newest consignment first.
 *
 * This is what lets a sale be started from the sale screen — pick the crop, say
 * it came out of cold storage, and choose from what is actually there — rather
 * than only from the lot's own page.
 */
export async function availableLots(
  cropCycleId: string,
  filter: { cropId?: string | null; coldStoreId?: string | null } = {},
): Promise<AvailableLot[]> {
  const entries = await listEntries(cropCycleId);
  const out: AvailableLot[] = [];

  for (const entry of entries) {
    if (filter.cropId && entry.cropId !== filter.cropId) continue;
    if (filter.coldStoreId && entry.coldStoreId !== filter.coldStoreId) continue;

    for (const lot of await entryLots(entry.id)) {
      const position = await lotPosition(lot.id);
      const remaining = position.remaining
        .filter((row) => row.remaining > 0)
        .map((row) => ({ gradeId: row.gradeId, remaining: row.remaining }));

      // A sold-out lot is not an option; it would only be a dead end.
      const total = remaining.reduce((sum, row) => sum + row.remaining, 0);
      if (total > 0) out.push({ lot, entry, remaining, total });
    }
  }

  return out;
}

/** The cold stores that currently hold anything, for the store picker. */
export async function storesWithStock(
  cropCycleId: string,
  cropId?: string | null,
): Promise<string[]> {
  const lots = await availableLots(cropCycleId, { cropId });
  return [...new Set(lots.map((l) => l.entry.coldStoreId).filter(Boolean) as string[])];
}
