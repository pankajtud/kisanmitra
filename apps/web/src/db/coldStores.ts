/**
 * Cold stores. Seeded with the one this household uses, and extensible —
 * whether the family deals with one store or several is an open question
 * (CLAUDE.md §15.3), so the app must not assume either.
 *
 * Archived, never deleted: inventory entries point at them, and removing one
 * would orphan the record of where produce actually sits (§2.7).
 */
import { uuidv7 } from '@kisanmitra/shared';
import { db } from './db.js';
import type { LocalColdStore } from './types.js';

export async function listColdStores(householdId: string, includeArchived = false) {
  const rows = await db.coldStores.where('householdId').equals(householdId).toArray();
  return rows
    .filter((s) => includeArchived || s.archivedAt === null)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder);
}

/** The store a new consignment starts on. */
export async function defaultColdStore(householdId: string): Promise<LocalColdStore | undefined> {
  const stores = await listColdStores(householdId);
  return stores.find((s) => s.isDefault) ?? stores[0];
}

export async function addColdStore(householdId: string, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await db.coldStores.where('householdId').equals(householdId).toArray();
  const match = existing.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (match) {
    if (match.archivedAt) await db.coldStores.put({ ...match, archivedAt: null });
    return match.id;
  }

  const id = uuidv7();
  await db.coldStores.put({
    id,
    householdId,
    name: trimmed,
    // Rent is left null: whether it is charged per season or per month is still
    // open (§15.5), and a guess would end up in a cost-per-packet.
    rentPerPacket: null,
    // The first store a household has is the one everything defaults to.
    isDefault: existing.length === 0,
    sortOrder: existing.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1,
    archivedAt: null,
  });
  return id;
}

export async function renameColdStore(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  const existing = await db.coldStores.get(id);
  if (!existing || !trimmed) return;
  await db.coldStores.put({ ...existing, name: trimmed });
}

/** Exactly one default per household, so a new consignment never has to ask. */
export async function makeDefaultColdStore(householdId: string, id: string): Promise<void> {
  const stores = await db.coldStores.where('householdId').equals(householdId).toArray();
  await db.coldStores.bulkPut(stores.map((store) => ({ ...store, isDefault: store.id === id })));
}

export async function archiveColdStore(id: string): Promise<void> {
  const existing = await db.coldStores.get(id);
  if (!existing) return;
  await db.coldStores.put({ ...existing, archivedAt: new Date().toISOString(), isDefault: false });

  // A household must always have somewhere to put produce by default.
  const remaining = await listColdStores(existing.householdId);
  if (remaining.length > 0 && !remaining.some((s) => s.isDefault)) {
    await db.coldStores.put({ ...remaining[0]!, isDefault: true });
  }
}

export async function restoreColdStore(id: string): Promise<void> {
  const existing = await db.coldStores.get(id);
  if (!existing) return;
  await db.coldStores.put({ ...existing, archivedAt: null });
}

/** How many consignments point at a store — shown before archiving. */
export async function coldStoreUsage(coldStoreId: string): Promise<number> {
  return db.inventoryEntries
    .where('coldStoreId')
    .equals(coldStoreId)
    .filter((e) => e.deletedAt === null)
    .count();
}
