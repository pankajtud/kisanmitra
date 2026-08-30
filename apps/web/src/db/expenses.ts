/**
 * Expense reads and writes. Everything is local and synchronous-feeling: no
 * function here awaits the network, and none can (CLAUDE.md §2.1).
 */
import { uuidv7 } from '@kisanmitra/shared';
import { db } from './db.js';
import type { AppContext } from './seed.js';
import type { LocalExpense, LocalPhoto, LocalReceipt } from './types.js';

export interface ExpenseInput {
  amount: number;
  spentOn: string;
  categoryId: string | null;
  fieldId: string | null;
  vendor: string | null;
  notes: string | null;
  entryMethod: LocalExpense['entryMethod'];
  receiptId?: string | null;
}

function now(): string {
  return new Date().toISOString();
}

/* --------------------------------------------------------------- capture */

export interface CapturedPhoto {
  blob: Blob;
  width: number;
  height: number;
  /** sha-256 of the bytes: dedupe, and the idempotency key for sync (§6). */
  hash: string;
}

/**
 * Step 2 of the receipt pipeline (§8): the photo is written to the local
 * database immediately, and a draft expense with no amount is created alongside
 * it, before anything else is attempted. If the user closes the app right here,
 * they still have their receipt.
 */
export async function saveReceiptDraft(
  ctx: AppContext,
  photo: CapturedPhoto,
): Promise<{ receiptId: string; expenseId: string }> {
  const receiptId = uuidv7();
  const expenseId = uuidv7();
  const timestamp = now();

  const receipt: LocalReceipt = {
    id: receiptId,
    householdId: ctx.householdId,
    photoPath: '', // assigned by the server on upload (M2)
    photoHash: photo.hash,
    capturedAt: timestamp,
    // No extraction until M3. Recorded honestly rather than left pending
    // forever, so the M3 backfill can tell these apart from real failures.
    extractionStatus: 'skipped',
    extractionProvider: null,
    extractionRaw: null,
    extractionConfidence: null,
    confirmedAt: null,
    confirmedBy: null,
    syncState: 'pending',
  };

  const photoRow: LocalPhoto = {
    receiptId,
    blob: photo.blob,
    width: photo.width,
    height: photo.height,
    bytes: photo.blob.size,
    capturedAt: timestamp,
    uploadedAt: null,
  };

  const draft: LocalExpense = {
    id: expenseId,
    householdId: ctx.householdId,
    cropCycleId: ctx.cropCycleId,
    categoryId: null,
    fieldId: null,
    spentOn: timestamp.slice(0, 10),
    amount: null,
    vendor: null,
    notes: null,
    receiptId,
    entryMethod: 'photo',
    createdBy: ctx.userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    status: 'draft',
    syncState: 'pending',
  };

  await db.transaction('rw', [db.receipts, db.photos, db.expenses], async () => {
    await db.receipts.put(receipt);
    await db.photos.put(photoRow);
    await db.expenses.put(draft);
  });

  return { receiptId, expenseId };
}

export function getPhoto(receiptId: string): Promise<LocalPhoto | undefined> {
  return db.photos.get(receiptId);
}

/* -------------------------------------------------------------- mutations */

/** Confirms a draft, or creates an expense outright when there is no photo. */
export async function saveExpense(
  ctx: AppContext,
  input: ExpenseInput,
  existingId?: string,
): Promise<string> {
  const timestamp = now();
  const id = existingId ?? uuidv7();

  await db.transaction('rw', [db.expenses, db.receipts], async () => {
    const existing = existingId ? await db.expenses.get(existingId) : undefined;

    const row: LocalExpense = {
      id,
      householdId: ctx.householdId,
      cropCycleId: existing?.cropCycleId ?? ctx.cropCycleId,
      categoryId: input.categoryId,
      fieldId: input.fieldId,
      spentOn: input.spentOn,
      amount: input.amount,
      vendor: input.vendor,
      notes: input.notes,
      receiptId: input.receiptId ?? existing?.receiptId ?? null,
      entryMethod: existing?.entryMethod ?? input.entryMethod,
      createdBy: existing?.createdBy ?? ctx.userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      status: 'confirmed',
      // Any edit puts the row back in the queue for M2 to pick up.
      syncState: 'pending',
    };
    await db.expenses.put(row);

    // The user has confirmed the values that sit next to this photo (§8.6).
    if (row.receiptId) {
      const receipt = await db.receipts.get(row.receiptId);
      if (receipt && !receipt.confirmedAt) {
        await db.receipts.put({
          ...receipt,
          confirmedAt: timestamp,
          confirmedBy: ctx.userId,
          syncState: 'pending',
        });
      }
    }
  });

  return id;
}

/** Soft delete. The row stays, and the photo is never touched (§2.2, §2.7). */
export async function deleteExpense(id: string): Promise<void> {
  const timestamp = now();
  const existing = await db.expenses.get(id);
  if (!existing) return;
  await db.expenses.put({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    syncState: 'pending',
  });
}

/**
 * Drafts the user abandoned without confirming. They keep their photo and stay
 * in the database; this is only used to keep them out of the register list.
 */
const isLive = (e: LocalExpense) => e.deletedAt === null;
const isConfirmed = (e: LocalExpense) => e.status === 'confirmed' && isLive(e);

/* ----------------------------------------------------------------- queries */

/** The season register: newest first, drafts and deleted rows excluded. */
export async function listExpenses(cropCycleId: string): Promise<LocalExpense[]> {
  const rows = await db.expenses.where('cropCycleId').equals(cropCycleId).filter(isConfirmed).toArray();
  return rows.sort(
    (a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function seasonTotal(cropCycleId: string): Promise<{ total: number; count: number }> {
  const rows = await listExpenses(cropCycleId);
  return {
    total: rows.reduce((sum, e) => sum + (e.amount ?? 0), 0),
    count: rows.length,
  };
}

export function getExpense(id: string): Promise<LocalExpense | undefined> {
  return db.expenses.get(id);
}

/** Count of records not yet sent. Until M2 that is all of them, and the UI says so. */
export function pendingCount(): Promise<number> {
  return db.expenses.where('syncState').equals('pending').count();
}
