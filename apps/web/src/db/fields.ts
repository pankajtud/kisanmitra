/**
 * Field (खेत) reference data. Seeded from the register — Jaynagar, Bhagat, GG,
 * Saudan, Bijali, Gadhi, "3 Bigha" — but every household has its own plots with
 * its own informal names, so they have to be editable from the phone rather
 * than only from a seed script (CLAUDE.md §1).
 *
 * Fields are archived, never deleted: expenses and lots point at them, and a
 * removed field would orphan the record of what was spent on it (§2.7).
 */
import { uuidv7 } from '@kisanmitra/shared';
import { db } from './db.js';
import type { LocalField } from './types.js';

export async function addField(householdId: string, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await db.fields.where('householdId').equals(householdId).toArray();

  // Re-adding an archived field brings it back rather than creating a twin.
  const match = existing.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
  if (match) {
    if (match.archivedAt) await db.fields.put({ ...match, archivedAt: null });
    return match.id;
  }

  const id = uuidv7();
  const field: LocalField = {
    id,
    householdId,
    name: trimmed,
    // Area in bighas is not asked for at creation: it is one more thing to type
    // and nothing in the app needs it until per-bigha costs at M7.
    areaBigha: null,
    sortOrder: existing.reduce((max, f) => Math.max(max, f.sortOrder), -1) + 1,
    archivedAt: null,
  };
  await db.fields.put(field);
  return id;
}

export async function renameField(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  const existing = await db.fields.get(id);
  if (!existing || !trimmed) return;
  await db.fields.put({ ...existing, name: trimmed });
}

/** Hidden from the pickers; existing records keep pointing at it. */
export async function archiveField(id: string): Promise<void> {
  const existing = await db.fields.get(id);
  if (!existing) return;
  await db.fields.put({ ...existing, archivedAt: new Date().toISOString() });
}

export async function restoreField(id: string): Promise<void> {
  const existing = await db.fields.get(id);
  if (!existing) return;
  await db.fields.put({ ...existing, archivedAt: null });
}

export async function listFields(householdId: string, includeArchived = false) {
  const rows = await db.fields.where('householdId').equals(householdId).toArray();
  return rows
    .filter((f) => includeArchived || f.archivedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * How many records point at a field — shown before archiving, so the user knows
 * what it affects.
 *
 * Counted against inventory *entries*, not lots: a lot is a place inside a cold
 * store and has no field of its own; the consignment it belongs to does.
 */
export async function fieldUsage(fieldId: string): Promise<{ expenses: number; lots: number }> {
  const [expenses, lots] = await Promise.all([
    db.expenses.where('fieldId').equals(fieldId).filter((e) => e.deletedAt === null).count(),
    db.inventoryEntries
      .where('fieldId')
      .equals(fieldId)
      .filter((e) => e.deletedAt === null)
      .count(),
  ]);
  return { expenses, lots };
}
