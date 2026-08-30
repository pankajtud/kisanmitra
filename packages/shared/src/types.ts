/**
 * Row types, inferred from the Drizzle schema. Type-only — this module compiles
 * away entirely, so importing it from the web client pulls no drizzle runtime
 * into the bundle.
 */
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type * as s from './schema.js';

export type Household = InferSelectModel<typeof s.households>;
export type User = InferSelectModel<typeof s.users>;
export type CropCycle = InferSelectModel<typeof s.cropCycles>;
export type Field = InferSelectModel<typeof s.fields>;
export type Grade = InferSelectModel<typeof s.grades>;
export type ColdStore = InferSelectModel<typeof s.coldStores>;
export type Lot = InferSelectModel<typeof s.lots>;
export type LotGrade = InferSelectModel<typeof s.lotGrades>;
export type Sale = InferSelectModel<typeof s.sales>;
export type SaleGrade = InferSelectModel<typeof s.saleGrades>;
export type ExpenseCategory = InferSelectModel<typeof s.expenseCategories>;
export type Expense = InferSelectModel<typeof s.expenses>;
export type Receipt = InferSelectModel<typeof s.receipts>;

export type NewHousehold = InferInsertModel<typeof s.households>;
export type NewUser = InferInsertModel<typeof s.users>;
export type NewCropCycle = InferInsertModel<typeof s.cropCycles>;
export type NewField = InferInsertModel<typeof s.fields>;
export type NewGrade = InferInsertModel<typeof s.grades>;
export type NewColdStore = InferInsertModel<typeof s.coldStores>;
export type NewLot = InferInsertModel<typeof s.lots>;
export type NewLotGrade = InferInsertModel<typeof s.lotGrades>;
export type NewSale = InferInsertModel<typeof s.sales>;
export type NewSaleGrade = InferInsertModel<typeof s.saleGrades>;
export type NewExpenseCategory = InferInsertModel<typeof s.expenseCategories>;
export type NewExpense = InferInsertModel<typeof s.expenses>;
export type NewReceipt = InferInsertModel<typeof s.receipts>;

export type Role = 'owner' | 'member' | 'viewer';
export type EntryMethod = 'photo' | 'manual' | 'voice' | 'whatsapp';
export type ExtractionStatus = 'pending' | 'done' | 'failed' | 'skipped';
