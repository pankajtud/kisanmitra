/**
 * The sync engine.
 *
 * Drains the outbox, then pulls everything the household has written elsewhere.
 * Nothing here is on the path of anything a farmer does: the record was saved
 * locally before this ran, and if it never runs the app still works
 * (CLAUDE.md §2.1).
 */
import type { PullResponse, PushResponse, SyncEntity } from '@kisanmitra/shared';
import { db } from './db.js';
import { defer, deviceId, dueItems, settle } from './outbox.js';

const CURSOR_KEY = 'km.syncCursor';

export type SyncPhase = 'idle' | 'pushing' | 'pulling' | 'offline' | 'signedOut' | 'failed';

export interface SyncOutcome {
  phase: SyncPhase;
  pushed: number;
  pulled: number;
  /** Writes the server refused as stale — someone else had edited them first. */
  superseded: number;
  error?: string;
}

function readCursor(): number {
  try {
    return Number(localStorage.getItem(CURSOR_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeCursor(cursor: number): void {
  try {
    localStorage.setItem(CURSOR_KEY, String(cursor));
  } catch {
    // A cursor that cannot be remembered means re-pulling the household's
    // history next time. Wasteful, not wrong — every apply is idempotent.
  }
}

export function resetCursor(): void {
  try {
    localStorage.removeItem(CURSOR_KEY);
  } catch {
    // Nothing to do.
  }
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
}

/** Which local table a synced entity lands in. */
const TABLES: Record<SyncEntity, string> = {
  households: 'households',
  users: 'users',
  cropCycles: 'cropCycles',
  crops: 'crops',
  fields: 'fields',
  grades: 'grades',
  coldStores: 'coldStores',
  expenseCategories: 'expenseCategories',
  khatas: 'khatas',
  khataPartners: 'khataPartners',
  inventoryEntries: 'inventoryEntries',
  lots: 'lots',
  lotGrades: 'lotGrades',
  receipts: 'receipts',
  expenses: 'expenses',
  sales: 'sales',
  saleGrades: 'saleGrades',
};

/**
 * Writes a record that came from the server.
 *
 * A row still waiting in this phone's outbox is left alone: the user's own
 * unsent edit is newer than anything the server can know about, and
 * overwriting it would lose work in front of them.
 */
async function applyPulled(records: PullResponse['records']): Promise<number> {
  if (records.length === 0) return 0;

  const queued = new Set((await db.outbox.toArray()).map((item) => item.entityId));
  let applied = 0;

  await db.transaction('rw', db.tables, async () => {
    for (const record of records) {
      const id = record.payload['id'] as string | undefined;
      if (!id || queued.has(id)) continue;

      const table = db.table(TABLES[record.entity]);
      // Arrived from the server, so by definition it is in step with it.
      await table.put({ ...record.payload, syncState: 'synced' });
      applied += 1;
    }
  });

  return applied;
}

/**
 * One round of sync. Safe to call repeatedly; safe to interrupt.
 *
 * Push first, so this phone's work is on the server before anything overwrites
 * it locally.
 */
export async function syncOnce(): Promise<SyncOutcome> {
  if (!navigator.onLine) return { phase: 'offline', pushed: 0, pulled: 0, superseded: 0 };

  let pushed = 0;
  let superseded = 0;

  const items = await dueItems();
  if (items.length > 0) {
    let response: Response;
    try {
      response = await post('/sync/push', {
        deviceId: deviceId(),
        items: items.map(({ id, entity, entityId, payload, updatedAt, createdAt }) => ({
          id, entity, entityId, payload, updatedAt, createdAt,
        })),
      });
    } catch (cause) {
      await defer(items, String(cause));
      return { phase: 'failed', pushed: 0, pulled: 0, superseded: 0, error: String(cause) };
    }

    if (response.status === 401) {
      return { phase: 'signedOut', pushed: 0, pulled: 0, superseded: 0 };
    }
    if (!response.ok) {
      const error = `push failed: ${response.status}`;
      await defer(items, error);
      return { phase: 'failed', pushed: 0, pulled: 0, superseded: 0, error };
    }

    const result = (await response.json()) as PushResponse;

    // Every outcome means the server has dealt with it — applied, already had
    // it, or has something newer. Only a transport failure keeps it queued.
    await settle(result.results.map((r) => r.id));
    pushed = result.results.filter((r) => r.outcome === 'applied').length;
    superseded = result.results.filter((r) => r.outcome === 'superseded').length;

    await markSynced(result.results.map((r) => r.entityId));
  }

  let pulled = 0;
  let cursor = readCursor();

  // A large first sync arrives in pages; keep going until caught up.
  for (let page = 0; page < 50; page += 1) {
    let response: Response;
    try {
      response = await fetch(`/sync/pull?since=${cursor}`, { credentials: 'include' });
    } catch (cause) {
      return { phase: 'failed', pushed, pulled, superseded, error: String(cause) };
    }

    if (response.status === 401) return { phase: 'signedOut', pushed, pulled, superseded };
    if (!response.ok) {
      return { phase: 'failed', pushed, pulled, superseded, error: `pull failed: ${response.status}` };
    }

    const body = (await response.json()) as PullResponse;
    pulled += await applyPulled(body.records);
    cursor = body.cursor;
    writeCursor(cursor);

    if (!body.hasMore) break;
  }

  return { phase: 'idle', pushed, pulled, superseded };
}

/** Marks records the server has taken, so the UI can stop calling them pending. */
async function markSynced(entityIds: readonly string[]): Promise<void> {
  const ids = new Set(entityIds);
  const stamp = async (name: string) => {
    const table = db.table(name);
    const rows = (await table.toArray()) as { id: string; syncState?: string }[];
    const touched = rows.filter((row) => ids.has(row.id) && row.syncState !== 'synced');
    if (touched.length > 0) {
      await table.bulkPut(touched.map((row) => ({ ...row, syncState: 'synced' })));
    }
  };

  for (const name of ['expenses', 'sales', 'khatas', 'inventoryEntries', 'lots', 'receipts']) {
    await stamp(name);
  }
}
