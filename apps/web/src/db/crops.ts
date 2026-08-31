/**
 * Crop reference data. Seeded with what this household grows, and editable —
 * nothing potato-specific may be hardcoded (CLAUDE.md §1).
 *
 * Crops are archived, never deleted: khatas, expenses, lots and sales all point
 * at them, and removing one would orphan the record of what was grown (§2.7).
 */
import { uuidv7 } from '@kisanmitra/shared';
import { db } from './db.js';
import type { LocalCrop } from './types.js';

export interface CropInput {
  nameHi: string;
  nameEn?: string;
  defaultUnit?: string | null;
  usesColdStorage?: boolean;
  defaultDurationMonths?: number | null;
}

/**
 * Adds a crop typed by the user, or returns the existing one if it is already
 * known. Matching is case-insensitive across both names so "gehun" typed twice
 * does not become two crops with separate totals.
 */
export async function addCrop(householdId: string, input: CropInput): Promise<string | null> {
  const nameHi = input.nameHi.trim();
  if (!nameHi) return null;

  const existing = await db.crops.where('householdId').equals(householdId).toArray();
  const match = existing.find(
    (crop) =>
      crop.nameHi.toLowerCase() === nameHi.toLowerCase() ||
      crop.nameEn.toLowerCase() === nameHi.toLowerCase(),
  );
  if (match) {
    if (match.archivedAt) await db.crops.put({ ...match, archivedAt: null });
    return match.id;
  }

  const id = uuidv7();
  const crop: LocalCrop = {
    id,
    householdId,
    nameHi,
    // A crop typed in Hindi has no English name to guess at, so it carries the
    // same string rather than a machine translation (§11).
    nameEn: input.nameEn?.trim() || nameHi,
    defaultUnit: input.defaultUnit ?? null,
    usesColdStorage: input.usesColdStorage ?? false,
    defaultDurationMonths: input.defaultDurationMonths ?? null,
    sortOrder: existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1,
    archivedAt: null,
  };
  await db.crops.put(crop);
  return id;
}

export async function archiveCrop(id: string): Promise<void> {
  const existing = await db.crops.get(id);
  if (!existing) return;
  await db.crops.put({ ...existing, archivedAt: new Date().toISOString() });
}

export async function listCrops(householdId: string, includeArchived = false) {
  const rows = await db.crops.where('householdId').equals(householdId).toArray();
  return rows
    .filter((c) => includeArchived || c.archivedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
