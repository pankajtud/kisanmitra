/**
 * The local database. Every write lands here first and nothing ever blocks on
 * the network (CLAUDE.md §2.1).
 *
 * Dexie mirrors the Postgres shape with an added `syncState`. Deletes are soft —
 * `deletedAt` is set and the row stays (§2.7). `deletedAt` is deliberately not
 * an index: IndexedDB skips null keys, so the live-row filter is applied in JS
 * over an already-narrow index range.
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  LocalColdStore,
  LocalCropCycle,
  LocalExpense,
  LocalExpenseCategory,
  LocalField,
  LocalGrade,
  LocalHousehold,
  LocalPhoto,
  LocalReceipt,
  LocalUser,
} from './types.js';

export class KisanMitraDb extends Dexie {
  households!: EntityTable<LocalHousehold, 'id'>;
  users!: EntityTable<LocalUser, 'id'>;
  cropCycles!: EntityTable<LocalCropCycle, 'id'>;
  fields!: EntityTable<LocalField, 'id'>;
  grades!: EntityTable<LocalGrade, 'id'>;
  coldStores!: EntityTable<LocalColdStore, 'id'>;
  expenseCategories!: EntityTable<LocalExpenseCategory, 'id'>;
  expenses!: EntityTable<LocalExpense, 'id'>;
  receipts!: EntityTable<LocalReceipt, 'id'>;
  photos!: EntityTable<LocalPhoto, 'receiptId'>;

  constructor(name = 'kisanmitra') {
    super(name);

    this.version(1).stores({
      households: 'id',
      users: 'id, householdId',
      cropCycles: 'id, householdId, isCurrent',
      fields: 'id, householdId, sortOrder',
      grades: 'id, householdId, sortOrder',
      coldStores: 'id, householdId',
      expenseCategories: 'id, householdId, sortOrder',
      // Listing is always "this crop cycle, newest first", hence the compound index.
      expenses: 'id, householdId, cropCycleId, [cropCycleId+spentOn], categoryId, syncState, status',
      receipts: 'id, householdId, photoHash, syncState, extractionStatus',
      photos: 'receiptId, uploadedAt',
    });
  }
}

export const db = new KisanMitraDb();
