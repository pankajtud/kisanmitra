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
import { seasonLabel } from '@kisanmitra/shared';
import type {
  LocalColdStore,
  LocalCrop,
  LocalCropCycle,
  LocalExpense,
  LocalExpenseCategory,
  LocalField,
  LocalGrade,
  LocalHousehold,
  LocalInventoryEntry,
  LocalKhata,
  LocalKhataPartner,
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
  khatas!: EntityTable<LocalKhata, 'id'>;
  khataPartners!: EntityTable<LocalKhataPartner, 'id'>;
  inventoryEntries!: EntityTable<LocalInventoryEntry, 'id'>;
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

    // v4 makes the khata the unit everything hangs off, and separates a stored
    // consignment (one cold store) from the lots it occupies inside it.
    this.version(4)
      .stores({
        khatas: 'id, householdId, cropCycleId, cropId, status, syncState',
        khataPartners: 'id, khataId',
        inventoryEntries: 'id, householdId, khataId, cropCycleId, coldStoreId, storedOn, syncState',
        lots: 'id, householdId, entryId, lotNo, syncState',
        expenses:
          'id, householdId, cropCycleId, khataId, [khataId+spentOn], [cropCycleId+spentOn], categoryId, syncState, status',
      })
      .upgrade(async (tx) => {
        // Rows written before this version have no sharing mode. 'khata' is the
        // default and means "follow the agreed split", which for a khata with no
        // partners is the whole amount — so existing totals do not move.
        await tx
          .table('expenses')
          .toCollection()
          .modify((row: { sharingMode?: string }) => {
            row.sharingMode ??= 'khata';
          });
        await tx
          .table('sales')
          .toCollection()
          .modify((row: { sharingMode?: string }) => {
            row.sharingMode ??= 'khata';
          });
      });

    // v5 gives a khata its season and intended duration. Existing khatas get a
    // season derived from the day they were opened; duration stays null, which
    // simply means no expected closing date rather than an overdue one.
    this.version(5).upgrade(async (tx) => {
      await tx
        .table('khatas')
        .toCollection()
        .modify((row: { openedOn?: string; season?: string | null; durationMonths?: number | null }) => {
          if (row.season == null && row.openedOn) row.season = seasonLabel(row.openedOn);
          row.durationMonths ??= null;
        });
    });

    // v6 indexes the keys the app actually queries by. Three were missing, and
    // each threw `KeyPath ... is not indexed` the moment its screen opened: a
    // khata's earnings, and the two counts behind the field editor.
    // `src/test/schema.test.ts` now checks every query against this schema, so
    // the next missing index fails a test rather than a farmer's screen.
    this.version(6).stores({
      sales:
        'id, householdId, lotId, cropId, cropCycleId, khataId, soldOn, [lotId+soldOn], [cropCycleId+soldOn], [khataId+soldOn], syncState',
      expenses:
        'id, householdId, cropCycleId, khataId, fieldId, [cropCycleId+spentOn], [khataId+spentOn], categoryId, syncState, status',
      inventoryEntries:
        'id, householdId, khataId, cropCycleId, cropId, coldStoreId, fieldId, storedOn, syncState',
    });
  }
}

export const db = new KisanMitraDb();
