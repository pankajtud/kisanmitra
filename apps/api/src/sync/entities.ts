/**
 * The tables sync touches, and how a row from a phone becomes a row in Postgres.
 *
 * Everything is scoped by `household_id` (CLAUDE.md §6). The scoping here is not
 * a filter a caller can forget — it is imposed on every row on the way in.
 */
import { schema } from '../db/client.js';
import { SYNC_ENTITIES, type SyncEntity } from '@kisanmitra/shared';

export const TABLES = {
  households: schema.households,
  users: schema.users,
  cropCycles: schema.cropCycles,
  crops: schema.crops,
  fields: schema.fields,
  grades: schema.grades,
  coldStores: schema.coldStores,
  expenseCategories: schema.expenseCategories,
  khatas: schema.khatas,
  khataPartners: schema.khataPartners,
  inventoryEntries: schema.inventoryEntries,
  lots: schema.lots,
  lotGrades: schema.lotGrades,
  receipts: schema.receipts,
  expenses: schema.expenses,
  sales: schema.sales,
  saleGrades: schema.saleGrades,
} as const;

/** Timestamp columns, so an ISO string from a phone becomes a Date. */
const TIMESTAMP_COLUMNS = new Set([
  'createdAt', 'updatedAt', 'deletedAt', 'archivedAt', 'capturedAt', 'confirmedAt',
]);

/** Columns a client may never set, whatever it sends. */
const SERVER_OWNED = new Set(['seq']);

/**
 * Client-only bookkeeping. `syncState` tracks what has been sent from one phone
 * and means nothing on the server.
 */
const CLIENT_ONLY = new Set(['syncState']);

export function tableFor(entity: SyncEntity) {
  return TABLES[entity];
}

export function columnsOf(entity: SyncEntity): Set<string> {
  const table = TABLES[entity] as unknown as Record<string, unknown>;
  return new Set(Object.keys(table).filter((key) => !key.startsWith('$') && !key.startsWith('_')));
}

/**
 * Turns what a phone sent into what Drizzle can insert.
 *
 * Unknown keys are dropped rather than rejected, so a phone running an older
 * build still syncs — it just does not carry the newest columns.
 */
export function toRow(
  entity: SyncEntity,
  payload: Record<string, unknown>,
  householdId: string,
): Record<string, unknown> {
  const allowed = columnsOf(entity);
  const row: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!allowed.has(key) || SERVER_OWNED.has(key) || CLIENT_ONLY.has(key)) continue;
    row[key] = TIMESTAMP_COLUMNS.has(key) && typeof value === 'string' ? new Date(value) : value;
  }

  // Imposed, never trusted: a phone cannot write into another household by
  // sending a different id.
  if (allowed.has('householdId')) row['householdId'] = householdId;

  return row;
}

/** The reverse: a Postgres row as a phone stores it. */
export function toPayload(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

export const ENTITIES = SYNC_ENTITIES;
