/**
 * Everything is scoped by `household_id` (CLAUDE.md §6). The point of this
 * layer is that a caller cannot forget the filter: it never receives the raw
 * `db` handle, only methods that have already applied it.
 *
 * The methods are written out per entity rather than generated from a table
 * map. A generic version compiled to worse types and read worse; this way the
 * household predicate is visible on every query, which is the property we
 * actually care about.
 *
 * Deletes are soft — `deleted_at` is set and the row stays (§2.7).
 */
import { and, desc, eq, isNull, sql as raw } from 'drizzle-orm';
import { db as defaultDb, schema, type Db } from './client.js';

const live = <T extends { deletedAt: unknown }>(table: T) => isNull(table.deletedAt as never);

export class HouseholdRepository {
  constructor(
    readonly householdId: string,
    private readonly db: Db = defaultDb,
  ) {}

  private get id() {
    return this.householdId;
  }

  /* --------------------------------------------------------- reference data */

  cropCycles() {
    return this.db
      .select()
      .from(schema.cropCycles)
      .where(eq(schema.cropCycles.householdId, this.id));
  }

  async currentCropCycle() {
    const rows = await this.db
      .select()
      .from(schema.cropCycles)
      .where(and(eq(schema.cropCycles.householdId, this.id), eq(schema.cropCycles.isCurrent, true)))
      .limit(1);
    return rows[0];
  }

  fields() {
    return this.db
      .select()
      .from(schema.fields)
      .where(and(eq(schema.fields.householdId, this.id), isNull(schema.fields.archivedAt)))
      .orderBy(schema.fields.sortOrder);
  }

  grades() {
    return this.db
      .select()
      .from(schema.grades)
      .where(eq(schema.grades.householdId, this.id))
      .orderBy(schema.grades.sortOrder);
  }

  expenseCategories() {
    return this.db
      .select()
      .from(schema.expenseCategories)
      .where(eq(schema.expenseCategories.householdId, this.id))
      .orderBy(schema.expenseCategories.sortOrder);
  }

  coldStores() {
    return this.db
      .select()
      .from(schema.coldStores)
      .where(eq(schema.coldStores.householdId, this.id));
  }

  /* ---------------------------------------------------------------- expenses */

  expensesForCycle(cropCycleId: string, limit = 500) {
    return this.db
      .select()
      .from(schema.expenses)
      .where(
        and(
          eq(schema.expenses.householdId, this.id),
          eq(schema.expenses.cropCycleId, cropCycleId),
          live(schema.expenses),
        ),
      )
      .orderBy(desc(schema.expenses.spentOn), desc(schema.expenses.createdAt))
      .limit(limit);
  }

  async expense(id: string) {
    const rows = await this.db
      .select()
      .from(schema.expenses)
      .where(and(eq(schema.expenses.householdId, this.id), eq(schema.expenses.id, id)))
      .limit(1);
    return rows[0];
  }

  /**
   * Idempotent by record ID, so replaying the outbox is safe, and last-write-wins
   * on `updated_at` so an out-of-order replay cannot resurrect stale values (§7).
   *
   * The losing version still needs to land in the `overwrites` audit table —
   * that table and the conflict path arrive with sync at M2.
   */
  async upsertExpense(value: typeof schema.expenses.$inferInsert) {
    const row = { ...value, householdId: this.id };
    const { id: _id, householdId: _household, ...updatable } = row;

    const rows = await this.db
      .insert(schema.expenses)
      .values(row)
      .onConflictDoUpdate({
        target: schema.expenses.id,
        set: updatable,
        setWhere: raw`${schema.expenses}.updated_at <= excluded.updated_at`,
      })
      .returning();

    // Empty means this write lost the conflict; the stored row is authoritative.
    return rows[0] ?? (await this.expense(row.id));
  }

  /** Soft delete. Nothing is ever removed. */
  async deleteExpense(id: string) {
    const at = new Date();
    await this.db
      .update(schema.expenses)
      .set({ deletedAt: at, updatedAt: at })
      .where(and(eq(schema.expenses.householdId, this.id), eq(schema.expenses.id, id)));
  }

  /* ---------------------------------------------------------------- receipts */

  async receipt(id: string) {
    const rows = await this.db
      .select()
      .from(schema.receipts)
      .where(and(eq(schema.receipts.householdId, this.id), eq(schema.receipts.id, id)))
      .limit(1);
    return rows[0];
  }

  /** Photos are content-addressed, so the same receipt uploaded twice is one row. */
  async receiptByHash(photoHash: string) {
    const rows = await this.db
      .select()
      .from(schema.receipts)
      .where(and(eq(schema.receipts.householdId, this.id), eq(schema.receipts.photoHash, photoHash)))
      .limit(1);
    return rows[0];
  }
}

export function forHousehold(householdId: string, db: Db = defaultDb): HouseholdRepository {
  return new HouseholdRepository(householdId, db);
}
