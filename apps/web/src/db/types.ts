/**
 * Local row shapes. These mirror the Postgres tables (types come from
 * `@kisanmitra/shared`, which infers them from the Drizzle schema) with the
 * additions IndexedDB needs.
 */
import type {
  ColdStore,
  CropCycle,
  Expense,
  ExpenseCategory,
  Field,
  Grade,
  Household,
  Receipt,
  User,
} from '@kisanmitra/shared';

/**
 * Honest sync state, shown per record (CLAUDE.md §7).
 *
 * M1 has no server, so every row sits at `pending` forever and the UI says
 * "saved on this phone". When M2 adds the outbox it drains exactly the rows
 * already marked `pending`, so a month of offline-only use syncs up rather than
 * needing a backfill.
 */
export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

/**
 * `draft` exists only on this device. A receipt photo creates a draft with no
 * amount the instant it is taken (§8.2), which Postgres cannot represent —
 * `expenses.amount` is NOT NULL there. Only `confirmed` rows are ever synced,
 * so the two models stay compatible.
 */
export type ExpenseStatus = 'draft' | 'confirmed';

type Local<T> = T & { syncState: SyncState };

/** Timestamps are ISO strings locally: IndexedDB keeps Date objects, but strings compare and sort predictably across a version upgrade. */
type Stringify<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};

export type LocalExpense = Local<Stringify<Omit<Expense, 'amount'>>> & {
  /** null while the expense is still a draft. */
  amount: number | null;
  status: ExpenseStatus;
};

export type LocalReceipt = Local<Stringify<Receipt>>;
export type LocalHousehold = Stringify<Household>;
export type LocalUser = Stringify<User>;
export type LocalCropCycle = CropCycle;
export type LocalField = Stringify<Field>;
export type LocalGrade = Grade;
export type LocalColdStore = ColdStore;
export type LocalExpenseCategory = ExpenseCategory;

/**
 * Photo bytes, kept out of the receipt row so listing receipts never drags
 * megabytes of JPEG through memory. Written before anything else and never
 * deleted automatically (§2.2).
 */
export interface LocalPhoto {
  receiptId: string;
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  capturedAt: string;
  /** Set once the photo has been uploaded. M2 owns this. */
  uploadedAt: string | null;
}
