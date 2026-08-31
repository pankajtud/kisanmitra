/**
 * खाता records: the venture, its partners, its ledger and its settlement.
 */
import {
  khataBalance,
  seasonLabel,
  today,
  uuidv7,
  type Partner,
  type SharingMode,
} from '@kisanmitra/shared';
import { db } from './db.js';
import type { AppContext } from './seed.js';
import type { LocalExpense, LocalKhata, LocalKhataPartner, LocalSale } from './types.js';

function now(): string {
  return new Date().toISOString();
}

const isLive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null;

export interface PartnerInput {
  name: string;
  sharePercent: number;
  isSelf: boolean;
}

export interface KhataInput {
  name: string;
  cropId: string | null;
  /** Which plot the venture is on. Optional — a khata may span the whole farm. */
  fieldId: string | null;
  /** '2025-26'. Derived from the opening date when not given. */
  season: string | null;
  openedOn: string;
  /** Intended length of the venture, in months. */
  durationMonths: number | null;
  notes: string | null;
  /** Includes the household's own row. Empty means the household keeps all of it. */
  partners: PartnerInput[];
}

export async function saveKhata(
  ctx: AppContext,
  input: KhataInput,
  existingId?: string,
): Promise<string> {
  const timestamp = now();
  const id = existingId ?? uuidv7();

  await db.transaction('rw', [db.khatas, db.khataPartners], async () => {
    const existing = existingId ? await db.khatas.get(existingId) : undefined;

    const khata: LocalKhata = {
      id,
      householdId: ctx.householdId,
      cropCycleId: existing?.cropCycleId ?? ctx.cropCycleId,
      cropId: input.cropId,
      fieldId: input.fieldId,
      name: input.name,
      season: input.season ?? seasonLabel(input.openedOn),
      openedOn: input.openedOn,
      durationMonths: input.durationMonths,
      status: existing?.status ?? 'open',
      settledOn: existing?.settledOn ?? null,
      notes: input.notes,
      createdBy: existing?.createdBy ?? ctx.userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncState: 'pending',
    };
    await db.khatas.put(khata);

    // Partners are restated wholesale: editing the agreement replaces it.
    const previous = await db.khataPartners.where('khataId').equals(id).toArray();
    await db.khataPartners.bulkDelete(previous.map((row) => row.id));

    if (input.partners.length > 0) {
      await db.khataPartners.bulkPut(
        input.partners.map((partner, index) => ({
          id: uuidv7(),
          khataId: id,
          name: partner.name.trim(),
          sharePercent: partner.sharePercent,
          isSelf: partner.isSelf,
          sortOrder: index,
        })),
      );
    }
  });

  return id;
}

export function getKhata(id: string): Promise<LocalKhata | undefined> {
  return db.khatas.get(id);
}

export async function listKhatas(householdId: string): Promise<LocalKhata[]> {
  const rows = await db.khatas.where('householdId').equals(householdId).filter(isLive).toArray();
  // Open ventures first — a settled khata is history.
  return rows.sort(
    (a, b) =>
      Number(a.status === 'settled') - Number(b.status === 'settled') ||
      b.openedOn.localeCompare(a.openedOn),
  );
}

export async function khataPartners(khataId: string): Promise<LocalKhataPartner[]> {
  const rows = await db.khataPartners.where('khataId').equals(khataId).toArray();
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Expenses and earnings in one khata, newest first. */
export async function khataLedger(khataId: string): Promise<{
  expenses: LocalExpense[];
  earnings: LocalSale[];
}> {
  const [expenses, earnings] = await Promise.all([
    db.expenses
      .where('khataId')
      .equals(khataId)
      .filter((e) => isLive(e) && e.status === 'confirmed')
      .toArray(),
    db.sales.where('khataId').equals(khataId).filter(isLive).toArray(),
  ]);

  return {
    expenses: expenses.sort((a, b) => b.spentOn.localeCompare(a.spentOn)),
    earnings: earnings.sort((a, b) => b.soldOn.localeCompare(a.soldOn)),
  };
}

const toPartner = (row: LocalKhataPartner): Partner => ({
  name: row.name,
  sharePercent: row.sharePercent,
  isSelf: row.isSelf,
});

/** The bottom line of a khata: what the venture made, and the household's part. */
export async function balanceOf(khataId: string) {
  const [ledger, partners] = await Promise.all([khataLedger(khataId), khataPartners(khataId)]);

  return khataBalance(
    ledger.expenses.map((e) => ({
      amount: e.amount,
      sharingMode: e.sharingMode as SharingMode,
      partnerShare: e.partnerShare,
    })),
    ledger.earnings.map((s) => ({
      amount: s.totalAmount,
      sharingMode: s.sharingMode as SharingMode,
      partnerShare: s.partnerShare,
    })),
    partners.map(toPartner),
  );
}

/**
 * Close a khata. Settled khatas are read-only: the partners have squared up
 * against these numbers, so nothing may move afterwards without reopening it.
 */
export async function settleKhata(id: string, settledOn = today()): Promise<void> {
  const existing = await db.khatas.get(id);
  if (!existing) return;
  await db.khatas.put({
    ...existing,
    status: 'settled',
    settledOn,
    updatedAt: now(),
    syncState: 'pending',
  });
}

export async function reopenKhata(id: string): Promise<void> {
  const existing = await db.khatas.get(id);
  if (!existing) return;
  await db.khatas.put({
    ...existing,
    status: 'open',
    settledOn: null,
    updatedAt: now(),
    syncState: 'pending',
  });
}

/** Soft delete, refused while the khata still holds records. */
export async function deleteKhata(id: string): Promise<{ ok: boolean; entries: number }> {
  const ledger = await khataLedger(id);
  const entries = ledger.expenses.length + ledger.earnings.length;
  if (entries > 0) return { ok: false, entries };

  const existing = await db.khatas.get(id);
  if (!existing) return { ok: true, entries: 0 };
  const timestamp = now();
  await db.khatas.put({ ...existing, deletedAt: timestamp, updatedAt: timestamp, syncState: 'pending' });
  return { ok: true, entries: 0 };
}

/** Partner names used across khatas, for the autocomplete. */
export async function knownPartnerNames(householdId: string): Promise<string[]> {
  const khatas = await db.khatas.where('householdId').equals(householdId).toArray();
  const rows = await db.khataPartners.where('khataId').anyOf(khatas.map((k) => k.id)).toArray();
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!row.isSelf && row.name && !seen.has(row.name.toLowerCase())) {
      seen.set(row.name.toLowerCase(), row.name);
    }
  }
  return [...seen.values()];
}
