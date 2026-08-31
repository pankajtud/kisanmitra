/**
 * The contract between a phone and the server.
 *
 * Both sides import this, so a change to the protocol cannot be made on one
 * side only.
 */

/** Every table that syncs, and the order a full push must apply them in. */
export const SYNC_ENTITIES = [
  'households',
  'users',
  'cropCycles',
  'crops',
  'fields',
  'grades',
  'coldStores',
  'expenseCategories',
  'khatas',
  'khataPartners',
  'inventoryEntries',
  'lots',
  'lotGrades',
  'receipts',
  'expenses',
  'sales',
  'saleGrades',
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];

/**
 * Parents before children. A push arriving as one batch is applied in this
 * order so a foreign key never points at a row that has not landed yet — a lot
 * cannot be written before the consignment it belongs to.
 */
export const ENTITY_ORDER: Record<SyncEntity, number> = Object.fromEntries(
  SYNC_ENTITIES.map((entity, index) => [entity, index]),
) as Record<SyncEntity, number>;

export function isSyncEntity(value: string): value is SyncEntity {
  return (SYNC_ENTITIES as readonly string[]).includes(value);
}

/** One queued mutation. Written by the client, replayable, safe to send twice. */
export interface OutboxItem {
  /** UUIDv7, so the queue drains in the order it was written. */
  id: string;
  entity: SyncEntity;
  /** The record's own id — what makes the server idempotent (§7). */
  entityId: string;
  /** The whole row as the client holds it. Deletes are soft, so they are upserts too. */
  payload: Record<string, unknown>;
  /** The row's `updatedAt`. The server compares this to decide conflicts. */
  updatedAt: string;
  createdAt: string;
  attempts: number;
  /** When the next attempt is allowed, after a failure. */
  nextAttemptAt: string | null;
  lastError: string | null;
}

export interface PushRequest {
  deviceId: string;
  items: Omit<OutboxItem, 'attempts' | 'nextAttemptAt' | 'lastError'>[];
}

export type PushOutcome =
  /** Stored. */
  | 'applied'
  /** A newer version was already there; the client's copy is stale. */
  | 'superseded'
  /** Already stored, byte for byte. A replay. */
  | 'duplicate';

export interface PushResult {
  id: string;
  entityId: string;
  outcome: PushOutcome;
}

export interface PushResponse {
  results: PushResult[];
  /** Where the client should pull from to see its own writes plus everyone else's. */
  cursor: number;
}

export interface PullRequest {
  since: number;
  limit?: number;
}

export interface PullResponse {
  /** Rows changed since the cursor, oldest first. */
  records: { entity: SyncEntity; payload: Record<string, unknown> }[];
  cursor: number;
  /** True when more remain; pull again straight away. */
  hasMore: boolean;
}

/**
 * How long to wait before retrying a failed item.
 *
 * Doubling, capped at five minutes. A phone that has been in a cold store all
 * afternoon should not hammer the server the moment it finds signal, and a
 * farmer should never wait on this: the record is already saved locally.
 */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(0, attempts - 1) * 1000, 5 * 60_000);
}

/** Nothing is dropped, ever — this only decides when to stop trying for now. */
export const MAX_ATTEMPTS_BEFORE_SLOW_LANE = 8;
