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
  LocalCrop,
  LocalCropCycle,
  LocalExpense,
  LocalExpenseCategory,
  LocalField,
  LocalGrade,
  LocalHousehold,
  LocalLot,
  LocalLotGrade,
  LocalPhoto,
  LocalReceipt,
  LocalSale,
  LocalSaleGrade,
  LocalUser,
} from './types.js';

export class KisanMitraDb extends Dexie {
  households!: EntityTable<LocalHousehold, 'id'>;
  users!: EntityTable<LocalUser, 'id'>;
  cropCycles!: EntityTable<LocalCropCycle, 'id'>;
  crops!: EntityTable<LocalCrop, 'id'>;
  fields!: EntityTable<LocalField, 'id'>;
  grades!: EntityTable<LocalGrade, 'id'>;
  coldStores!: EntityTable<LocalColdStore, 'id'>;
  expenseCategories!: EntityTable<LocalExpenseCategory, 'id'>;
  expenses!: EntityTable<LocalExpense, 'id'>;
  receipts!: EntityTable<LocalReceipt, 'id'>;
  photos!: EntityTable<LocalPhoto, 'receiptId'>;
  lots!: EntityTable<LocalLot, 'id'>;
  lotGrades!: EntityTable<LocalLotGrade, 'id'>;
  sales!: EntityTable<LocalSale, 'id'>;
  saleGrades!: EntityTable<LocalSaleGrade, 'id'>;

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

    // v2 adds the stock register and sales (M5, M6). Dexie carries every
    // existing row forward untouched; the new expense columns need no
    // migration because they are not indexed and default to null when read.
    this.version(2).stores({
      lots: 'id, householdId, cropCycleId, [cropCycleId+storedOn], coldStoreId, fieldId, lotNo, syncState',
      lotGrades: 'id, lotId, gradeId, [lotId+gradeId]',
      // Sales are always read per lot, to work out what is left in storage.
      sales: 'id, householdId, lotId, soldOn, [lotId+soldOn], syncState',
      saleGrades: 'id, saleId, gradeId, [saleId+gradeId]',
    });

    // v3 adds crops. Potato is one component of the farm, not the whole of it:
    // wheat and mustard are sold straight off the field and never become lots.
    this.version(3).stores({
      crops: 'id, householdId, sortOrder',
      // Sales are now listed per season as well as per lot, because a sale need
      // not belong to a lot at all.
      sales: 'id, householdId, lotId, cropId, cropCycleId, soldOn, [lotId+soldOn], [cropCycleId+soldOn], syncState',
    });
  }
}

export const db = new KisanMitraDb();
