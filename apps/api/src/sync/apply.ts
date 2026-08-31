/**
 * Applying one record from a phone.
 *
 * Two rules do all the work (CLAUDE.md §7):
 *
 *   - **Idempotent by record id**, so replaying the outbox is safe and a phone
 *     that dies mid-push can simply send everything again.
 *   - **Last write wins on `updated_at`**, with the losing version kept in
 *     `overwrites` — last-write-wins discards something by definition, and §2.7
 *     says nothing is ever truly lost.
 */
import { eq, sql } from 'drizzle-orm';
import { uuidv7, type PushOutcome, type SyncEntity } from '@kisanmitra/shared';
import { db, schema } from '../db/client.js';
import { tableFor, toPayload, toRow } from './entities.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface IncomingRecord {
  entity: SyncEntity;
  entityId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}

/**
 * Serialises pushes for one household.
 *
 * Without it, two phones pushing at once could take change sequence numbers in
 * one order and commit in another; a client pulling in between would step over
 * a change and never see it again. Held for the transaction, and the contention
 * is a few family members, not a crowd.
 */
export async function lockHousehold(tx: Tx, householdId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${householdId}, 0))`);
}

export async function applyRecord(
  tx: Tx,
  householdId: string,
  deviceId: string | null,
  record: IncomingRecord,
): Promise<PushOutcome> {
  const table = tableFor(record.entity);
  const columns = table as unknown as Record<string, unknown>;
  const row = toRow(record.entity, record.payload, householdId);
  const incoming = new Date(record.updatedAt);

  const existing = (
    await tx.select().from(table).where(eq(columns['id'] as never, record.entityId)).limit(1)
  )[0] as Record<string, unknown> | undefined;

  if (existing) {
    const storedAt = existing['updatedAt'];
    const stored = storedAt instanceof Date ? storedAt : new Date(0);

    // The same write arriving twice — a replay. Nothing to do, nothing to log.
    if (stored.getTime() === incoming.getTime()) return 'duplicate';

    if (incoming < stored) {
      // This phone is behind. Its version is kept so the household can see what
      // it said, but the stored one stands.
      await keepLoser(tx, householdId, record, existing, 'incoming', deviceId, stored);
      return 'superseded';
    }

    // The incoming write is newer, so what it replaces is kept.
    await keepLoser(tx, householdId, record, existing, 'stored', deviceId, incoming);
  }

  const { id: _id, ...updatable } = row;
  await tx
    .insert(table)
    .values({ ...row, id: record.entityId } as never)
    .onConflictDoUpdate({ target: columns['id'] as never, set: updatable as never });

  await tx.insert(schema.changes).values({
    householdId,
    entity: record.entity,
    entityId: record.entityId,
    deviceId,
    updatedAt: incoming,
  });

  return 'applied';
}

async function keepLoser(
  tx: Tx,
  householdId: string,
  record: IncomingRecord,
  existing: Record<string, unknown>,
  loser: 'incoming' | 'stored',
  deviceId: string | null,
  winningUpdatedAt: Date,
): Promise<void> {
  await tx.insert(schema.overwrites).values({
    id: uuidv7(),
    householdId,
    entity: record.entity,
    entityId: record.entityId,
    losingPayload: loser === 'incoming' ? record.payload : toPayload(existing),
    losingUpdatedAt:
      loser === 'incoming'
        ? new Date(record.updatedAt)
        : ((existing['updatedAt'] as Date | undefined) ?? new Date(0)),
    winningUpdatedAt,
    loser,
    deviceId,
  });
}
