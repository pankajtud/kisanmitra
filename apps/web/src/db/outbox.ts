/**
 * The outbox.
 *
 * Every mutation writes to Dexie and appends an entry here, in the same
 * transaction, so a record and its intent to send can never disagree
 * (CLAUDE.md §7). A background task drains it when there is a network; nothing
 * a farmer does ever waits on that.
 *
 * Entries are only removed once the server has confirmed them. A failure leaves
 * the entry in place with a longer wait — nothing is dropped, ever.
 */
import { retryDelayMs, uuidv7, type OutboxItem, type SyncEntity } from '@kisanmitra/shared';
import type { Transaction } from 'dexie';
import { db } from './db.js';

/** A device id, so this phone can tell its own writes from everyone else's. */
const DEVICE_KEY = 'km.deviceId';

export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = uuidv7();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    // Storage blocked. A per-session id still works; it only affects whether
    // this phone recognises its own echo, which is a nicety, not correctness.
    return 'ephemeral';
  }
}

type Row = { id: string; updatedAt?: string | null };

/**
 * Queues one record. Called inside the same transaction as the write itself.
 *
 * The whole row is stored rather than a diff: the server is idempotent by
 * record id and resolves conflicts by comparing `updatedAt`, so a complete
 * picture of the record is exactly what it needs — and a replay stays safe.
 */
export function enqueue(
  tx: Transaction | null,
  entity: SyncEntity,
  row: Row,
): Promise<unknown> {
  const now = new Date().toISOString();
  const item: OutboxItem = {
    id: uuidv7(),
    entity,
    entityId: row.id,
    payload: { ...row } as Record<string, unknown>,
    updatedAt: row.updatedAt ?? now,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  };

  const table = tx ? tx.table('outbox') : db.outbox;
  return table.put(item as never);
}

/** Queues several rows at once — a lot and its grades, a khata and its partners. */
export async function enqueueAll(
  tx: Transaction | null,
  entity: SyncEntity,
  rows: readonly Row[],
): Promise<void> {
  for (const row of rows) await enqueue(tx, entity, row);
}

/**
 * The next batch to send, oldest first.
 *
 * Ordered by the entry's own UUIDv7, which encodes when it was written — so the
 * queue drains in the order the farmer did things, and a parent is sent before
 * the child that references it.
 */
export async function dueItems(limit = 200, now = Date.now()): Promise<OutboxItem[]> {
  const all = await db.outbox.toArray();
  return all
    .filter((item) => !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Confirmed by the server. Only now is it safe to forget. */
export async function settle(ids: readonly string[]): Promise<void> {
  if (ids.length > 0) await db.outbox.bulkDelete([...ids]);
}

/**
 * A failed attempt. The entry stays queued with a longer wait — a phone that
 * has been in a cold store all afternoon must not hammer the server the moment
 * it finds signal.
 */
export async function defer(items: readonly OutboxItem[], error: string): Promise<void> {
  const now = Date.now();
  await db.outbox.bulkPut(
    items.map((item) => {
      const attempts = item.attempts + 1;
      return {
        ...item,
        attempts,
        nextAttemptAt: new Date(now + retryDelayMs(attempts)).toISOString(),
        lastError: error.slice(0, 300),
      };
    }),
  );
}

export function pendingCount(): Promise<number> {
  return db.outbox.count();
}

/**
 * Everything already in the database that has never been sent.
 *
 * A household used the app offline for weeks before there was a server. Those
 * records are real and must reach it, so signing in for the first time queues
 * them rather than leaving them stranded on the phone.
 */
export async function backfillFromLocalRecords(householdId: string): Promise<number> {
  const alreadyQueued = new Set((await db.outbox.toArray()).map((item) => item.entityId));
  let queued = 0;

  const push = async (entity: SyncEntity, rows: Row[]) => {
    for (const row of rows) {
      if (alreadyQueued.has(row.id)) continue;
      await enqueue(null, entity, row);
      queued += 1;
    }
  };

  const mine = <T extends { householdId?: string | null }>(rows: T[]) =>
    rows.filter((row) => !row.householdId || row.householdId === householdId);

  await push('households', await db.households.toArray());
  await push('users', mine(await db.users.toArray()));
  await push('cropCycles', mine(await db.cropCycles.toArray()));
  await push('crops', mine(await db.crops.toArray()));
  await push('fields', mine(await db.fields.toArray()));
  await push('grades', mine(await db.grades.toArray()));
  await push('coldStores', mine(await db.coldStores.toArray()));
  await push('expenseCategories', mine(await db.expenseCategories.toArray()));
  await push('khatas', mine(await db.khatas.toArray()));
  await push('khataPartners', await db.khataPartners.toArray());
  await push('inventoryEntries', mine(await db.inventoryEntries.toArray()));
  await push('lots', mine(await db.lots.toArray()));
  await push('lotGrades', await db.lotGrades.toArray());
  await push('receipts', mine(await db.receipts.toArray()));
  // Drafts have no amount yet and would fail a NOT NULL on the server; they are
  // this phone's business until confirmed (§8.2).
  await push('expenses', mine(await db.expenses.toArray()).filter((e) => e.status === 'confirmed'));
  await push('sales', mine(await db.sales.toArray()));
  await push('saleGrades', await db.saleGrades.toArray());

  return queued;
}
