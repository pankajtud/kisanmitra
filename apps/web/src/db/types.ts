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
  Crop,
  Grade,
  Household,
  InventoryEntry,
  Khata,
  KhataPartner,
  Lot,
  LotGrade,
  Receipt,
  Sale,
  SaleGrade,
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

/** Re-exported so callers need not reach into the shared domain for it. */
export type { SharingMode } from '@kisanmitra/shared';

type Local<T> = T & { syncState: SyncState };

/** Timestamps are ISO strings locally: IndexedDB keeps Date objects, but strings compare and sort predictably across a version upgrade. */
type Stringify<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};

export type LocalExpense = Local<
  Stringify<Omit<Expense, 'amount' | 'partnerShare' | 'quantity'>>
> & {
  /** null while the expense is still a draft. */
  amount: number | null;
  /** The partner's portion in rupees. null when the cost is not shared. */
  partnerShare: number | null;
  /** How much was bought — 60 litres of diesel, 2 sacks of urea. */
  quantity: number | null;
  status: ExpenseStatus;
};

export type LocalCrop = Stringify<Crop>;

/* ------------------------------------------------------------------- stock */

export type LocalKhata = Local<Stringify<Khata>>;

/** Shares are percentages, held as numbers locally for arithmetic. */
export type LocalKhataPartner = Omit<KhataPartner, 'sharePercent'> & { sharePercent: number };

export type LocalInventoryEntry = Local<Stringify<InventoryEntry>>;

/** A lot is a place inside one cold store, holding part of an entry. */
export type LocalLot = Local<Stringify<Lot>>;
/** Packets per grade in a lot. Scoped through its parent lot, not household_id. */
export type LocalLotGrade = LotGrade;

export type LocalSale = Local<
  Stringify<Omit<Sale, 'ratePerPacket' | 'totalAmount' | 'quantity' | 'partnerShare'>>
> & {
  ratePerPacket: number | null;
  totalAmount: number | null;
  /** Quantity for a sale that never went into storage — 12 कुंतल of wheat. */
  quantity: number | null;
  /** The partner's cut of the income, mirroring expenses. */
  partnerShare: number | null;
};

export type LocalSaleGrade = Omit<SaleGrade, 'ratePerPacket'> & {
  /** Grades often fetch different rates in the same sale. */
  ratePerPacket: number | null;
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
