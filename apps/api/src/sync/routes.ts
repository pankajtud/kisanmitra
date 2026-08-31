/**
 * The two endpoints a phone talks to.
 *
 * Both are idempotent and neither blocks the user: a farmer's record is already
 * saved on the phone before any of this runs (CLAUDE.md §2.1).
 */
import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import {
  ENTITY_ORDER,
  isSyncEntity,
  type PullResponse,
  type PushResponse,
  type PushResult,
  type SyncEntity,
} from '@kisanmitra/shared';
import { db, schema } from '../db/client.js';
import { applyRecord, lockHousehold } from './apply.js';
import { tableFor, toPayload } from './entities.js';
import type { Session } from '../auth.js';

const MAX_PULL = 500;

export type SessionResolver = (request: { cookies: Record<string, string | undefined> }) => Promise<Session | null>;

export function syncRoutes(app: FastifyInstance, resolve: SessionResolver) {
  /** Every route runs as a signed-in user; the household comes from the session, never the body (§6). */
  async function requireSession(request: {
    cookies: Record<string, string | undefined>;
  }): Promise<Session> {
    const session = await resolve(request);
    if (!session) throw Object.assign(new Error('not signed in'), { statusCode: 401 });
    return session;
  }

  /**
   * Take a batch of queued mutations.
   *
   * The whole batch is one transaction under one household lock, so either the
   * lot lands or none of it does, and two phones pushing at once cannot
   * interleave into an order a puller would miss.
   */
  app.post('/sync/push', async (request, reply) => {
    const session = await requireSession(request);
    const body = request.body as {
      deviceId?: string;
      items?: {
        id: string;
        entity: string;
        entityId: string;
        payload: Record<string, unknown>;
        updatedAt: string;
      }[];
    };

    const items = body.items ?? [];
    if (items.length === 0) {
      return reply.send({ results: [], cursor: await cursorFor(session.householdId) });
    }

    for (const item of items) {
      if (!isSyncEntity(item.entity)) {
        return reply.status(400).send({ error: `unknown entity: ${item.entity}` });
      }
    }

    // Parents before children, so a foreign key never points at a row that has
    // not landed yet — a lot cannot be written before its consignment.
    const ordered = [...items].sort(
      (a, b) =>
        ENTITY_ORDER[a.entity as SyncEntity] - ENTITY_ORDER[b.entity as SyncEntity] ||
        a.id.localeCompare(b.id),
    );

    const results: PushResult[] = [];

    await db.transaction(async (tx) => {
      await lockHousehold(tx, session.householdId);
      for (const item of ordered) {
        const outcome = await applyRecord(tx, session.householdId, body.deviceId ?? null, {
          entity: item.entity as SyncEntity,
          entityId: item.entityId,
          payload: item.payload,
          updatedAt: item.updatedAt,
        });
        results.push({ id: item.id, entityId: item.entityId, outcome });
      }
    });

    const response: PushResponse = { results, cursor: await cursorFor(session.householdId) };
    return reply.send(response);
  });

  /**
   * Everything that changed since the client's cursor, oldest first.
   *
   * Ordering is by `seq`, not by time: two phones writing in the same second,
   * or with skewed clocks, would make records invisible to each other under a
   * timestamp watermark.
   */
  app.get('/sync/pull', async (request, reply) => {
    const session = await requireSession(request);
    const query = request.query as { since?: string; limit?: string };
    const since = Number(query.since ?? 0) || 0;
    const limit = Math.min(Number(query.limit ?? MAX_PULL) || MAX_PULL, MAX_PULL);

    const changed = await db
      .select()
      .from(schema.changes)
      .where(and(eq(schema.changes.householdId, session.householdId), gt(schema.changes.seq, since)))
      .orderBy(asc(schema.changes.seq))
      .limit(limit + 1);

    const hasMore = changed.length > limit;
    const page = hasMore ? changed.slice(0, limit) : changed;

    if (page.length === 0) {
      const empty: PullResponse = { records: [], cursor: since, hasMore: false };
      return reply.send(empty);
    }

    // The ledger says *what* changed; the rows themselves are read fresh, so a
    // record touched several times is sent once, in its current state.
    const wanted = new Map<SyncEntity, Set<string>>();
    for (const change of page) {
      const entity = change.entity as SyncEntity;
      const ids = wanted.get(entity) ?? new Set<string>();
      ids.add(change.entityId);
      wanted.set(entity, ids);
    }

    const records: PullResponse['records'] = [];
    for (const entity of [...wanted.keys()].sort((a, b) => ENTITY_ORDER[a] - ENTITY_ORDER[b])) {
      const table = tableFor(entity);
      const columns = table as unknown as Record<string, unknown>;
      const rows = await db
        .select()
        .from(table)
        .where(inArray(columns['id'] as never, [...wanted.get(entity)!]));

      for (const row of rows) {
        records.push({ entity, payload: toPayload(row as Record<string, unknown>) });
      }
    }

    const response: PullResponse = {
      records,
      cursor: page[page.length - 1]!.seq,
      hasMore,
    };
    return reply.send(response);
  });

  /** What a phone shows when the user asks why two numbers disagree. */
  app.get('/sync/overwrites', async (request, reply) => {
    const session = await requireSession(request);
    const rows = await db
      .select()
      .from(schema.overwrites)
      .where(eq(schema.overwrites.householdId, session.householdId))
      .orderBy(asc(schema.overwrites.createdAt))
      .limit(200);
    return reply.send({ overwrites: rows });
  });
}

async function cursorFor(householdId: string): Promise<number> {
  const rows = await db
    .select({ seq: schema.changes.seq })
    .from(schema.changes)
    .where(eq(schema.changes.householdId, householdId))
    .orderBy(asc(schema.changes.seq));
  return rows.length > 0 ? rows[rows.length - 1]!.seq : 0;
}
