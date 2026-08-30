/**
 * Postgres schema — authoritative. Dexie mirrors this shape client-side with an
 * added `syncState` column (see apps/web/src/db).
 *
 * All row types used anywhere in the monorepo are inferred from here. Do not
 * hand-write a duplicate interface.
 */
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/* ---------------------------------------------------------------- reference */

export const households = pgTable('households', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  village: text('village'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  phone: text('phone').notNull().unique(), // E.164
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('member'), // 'owner' | 'member' | 'viewer'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cropCycles = pgTable('crop_cycles', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  label: text('label').notNull(), // '2025-26'
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on'),
  isCurrent: boolean('is_current').notNull().default(false),
});

export const fields = pgTable('fields', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  name: text('name').notNull(), // 'Jaynagar', '3 Bigha'
  areaBigha: numeric('area_bigha', { precision: 8, scale: 2 }),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const grades = pgTable(
  'grades',
  {
    id: uuid('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    code: text('code').notNull(), // 'M', 'G', 'H', 'K', 'B'
    labelHi: text('label_hi').notNull(), // 'मोटा'
    labelEn: text('label_en').notNull(), // 'Mota (large)'
    photoUrl: text('photo_url'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [unique('grades_household_code_key').on(t.householdId, t.code)],
);

/**
 * What the household grows and sells. Potato is one of several — wheat,
 * mustard, peas — so nothing downstream may assume it (CLAUDE.md §1).
 *
 * Seeded with the crops this household actually farms, and editable.
 */
export const crops = pgTable('crops', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  nameHi: text('name_hi').notNull(), // 'आलू'
  nameEn: text('name_en').notNull(), // 'Potato'
  /** The unit this crop is normally measured in: 'बोरा', 'कुंतल', 'किलो'. */
  defaultUnit: text('default_unit'),
  /** Only potato goes into cold storage as graded lots; wheat is sold straight off the field. */
  usesColdStorage: boolean('uses_cold_storage').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const coldStores = pgTable('cold_stores', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  name: text('name').notNull(), // 'G.L. Cold Storage, Chitaura'
  rentPerPacket: numeric('rent_per_packet', { precision: 10, scale: 2 }),
});

/* -------------------------------------------------------------------- stock */

export const lots = pgTable('lots', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  cropCycleId: uuid('crop_cycle_id')
    .notNull()
    .references(() => cropCycles.id),
  coldStoreId: uuid('cold_store_id').references(() => coldStores.id),
  cropId: uuid('crop_id').references(() => crops.id),
  /** Opaque text, exactly as written on paper ('91/251'). Derive nothing from it — CLAUDE.md §15.1. */
  lotNo: text('lot_no').notNull(),
  serialNo: integer('serial_no'), // S. NO. in the paper register
  storedOn: date('stored_on').notNull(),
  roomRack: text('room_rack'),
  variety: text('variety'), // '37-97', '302'
  fieldId: uuid('field_id').references(() => fields.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const lotGrades = pgTable(
  'lot_grades',
  {
    id: uuid('id').primaryKey(),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => lots.id, { onDelete: 'cascade' }),
    gradeId: uuid('grade_id')
      .notNull()
      .references(() => grades.id),
    packets: integer('packets').notNull(),
  },
  (t) => [
    unique('lot_grades_lot_grade_key').on(t.lotId, t.gradeId),
    check('lot_grades_packets_check', sql`${t.packets} >= 0`),
  ],
);

/* -------------------------------------------------------------------- sales */

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  cropCycleId: uuid('crop_cycle_id').references(() => cropCycles.id),
  /**
   * Null for anything not sold out of cold storage. Wheat and mustard go
   * straight from the field to the buyer and never become a lot, so a sale
   * cannot require one.
   */
  lotId: uuid('lot_id').references(() => lots.id),
  cropId: uuid('crop_id').references(() => crops.id),
  fieldId: uuid('field_id').references(() => fields.id),
  soldOn: date('sold_on').notNull(),
  buyer: text('buyer'),
  /** Quantity for a non-lot sale — 12 कुंतल of wheat. Lot sales count packets per grade instead. */
  quantity: numeric('quantity', { precision: 12, scale: 3 }),
  unit: text('unit'),
  ratePerPacket: numeric('rate_per_packet', { precision: 10, scale: 2 }),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }),
  notes: text('notes'),

  /**
   * Income sharing, mirroring expenses. A crop grown in partnership splits both
   * ways: the household's own income is `total_amount - partner_share`.
   */
  partnerName: text('partner_name'),
  partnerShare: numeric('partner_share', { precision: 12, scale: 2 }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const saleGrades = pgTable(
  'sale_grades',
  {
    id: uuid('id').primaryKey(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    gradeId: uuid('grade_id')
      .notNull()
      .references(() => grades.id),
    packets: integer('packets').notNull(),
    /** Grades often fetch different rates. */
    ratePerPacket: numeric('rate_per_packet', { precision: 10, scale: 2 }),
  },
  (t) => [
    unique('sale_grades_sale_grade_key').on(t.saleId, t.gradeId),
    check('sale_grades_packets_check', sql`${t.packets} > 0`),
  ],
);

/* ----------------------------------------------------------------- expenses */

export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  key: text('key').notNull(),
  labelHi: text('label_hi').notNull(),
  labelEn: text('label_en').notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/**
 * Declared before `expenses` so the FK resolves in a single migration.
 * The `expenses.receipt_id` constraint is still added in a follow-up
 * migration (0001) as CLAUDE.md §6 requires.
 */
export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  photoPath: text('photo_path').notNull(),
  /** Dedupe, and idempotency key for sync. */
  photoHash: text('photo_hash').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  extractionStatus: text('extraction_status').notNull(), // 'pending'|'done'|'failed'|'skipped'
  extractionProvider: text('extraction_provider'),
  /** Exactly what the model returned. Retained forever. */
  extractionRaw: jsonb('extraction_raw'),
  extractionConfidence: jsonb('extraction_confidence'), // per-field 0..1
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  confirmedBy: uuid('confirmed_by').references(() => users.id),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  cropCycleId: uuid('crop_cycle_id')
    .notNull()
    .references(() => cropCycles.id),
  categoryId: uuid('category_id').references(() => expenseCategories.id),
  /** null = whole farm */
  fieldId: uuid('field_id').references(() => fields.id),
  spentOn: date('spent_on').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  vendor: text('vendor'),
  notes: text('notes'),
  receiptId: uuid('receipt_id').references(() => receipts.id),
  entryMethod: text('entry_method').notNull(), // 'photo' | 'manual' | 'voice' | 'whatsapp'

  /**
   * Cost sharing. Joint costs — a hired tractor, a pump, a truck — are split
   * with a partner, and only the household's own portion is its cost.
   *
   * Free text with autocomplete over past values, the same treatment as
   * `variety` (CLAUDE.md §5). A partner is a name, not an account: they do not
   * use the app.
   */
  partnerName: text('partner_name'),
  /**
   * The partner's portion in rupees, not a percentage — receipts are split by
   * amount and the percentage is derived for display. Null means the whole
   * expense is the household's own.
   *
   * `householdShare = amount - coalesce(partner_share, 0)`, which is what the
   * season total and M7's cost-per-unit must both use.
   */
  partnerShare: numeric('partner_share', { precision: 12, scale: 2 }),

  /** Which crop the money was spent on. Null = the whole farm. */
  cropId: uuid('crop_id').references(() => crops.id),
  /** What was actually bought: 'यूरिया', 'DAP'. Free text with autocomplete. */
  product: text('product'),
  quantity: numeric('quantity', { precision: 12, scale: 3 }),
  unit: text('unit'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
