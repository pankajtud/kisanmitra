/**
 * The sync engine, against a real Postgres.
 *
 * CLAUDE.md §14 names the sync engine and the outbox as the parts that must
 * have real tests, and this is why: correctness here is about transactions,
 * advisory locks and a monotonic sequence. A fake database reproduces none of
 * those, and they are exactly where the bugs would be.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { uuidv7 } from '@kisanmitra/shared';
import { db, schema, sql } from '../db/client.js';
import { applyRecord, lockHousehold, type IncomingRecord } from '../sync/apply.js';

let householdId: string;
let userId: string;
let cycleId: string;

beforeAll(async () => {
  await sql`select 1`;
});

beforeEach(async () => {
  householdId = uuidv7();
  userId = uuidv7();
  cycleId = uuidv7();

  await db.insert(schema.households).values({ id: householdId, name: 'Test' });
  await db.insert(schema.users).values({
    id: userId, householdId, phone: `+9155${Date.now() % 100000000}`, displayName: 'T', role: 'owner',
  });
  await db.insert(schema.cropCycles).values({
    id: cycleId, householdId, label: '2025-26', startsOn: '2025-10-01', isCurrent: true,
  });
});

function expense(id: string, amount: number, updatedAt: string): IncomingRecord {
  return {
    entity: 'expenses',
    entityId: id,
    updatedAt,
    payload: {
      id, householdId, cropCycleId: cycleId, spentOn: '2026-02-27', amount: String(amount),
      entryMethod: 'manual', sharingMode: 'khata', createdAt: updatedAt, updatedAt,
    },
  };
}

const push = (record: IncomingRecord, deviceId = 'phone-a') =>
  db.transaction(async (tx) => {
    await lockHousehold(tx, householdId);
    return applyRecord(tx, householdId, deviceId, record);
  });

describe('idempotency', () => {
  it('applies a record once, however many times it is sent', async () => {
    const id = uuidv7();
    const record = expense(id, 4500, '2026-02-27T10:00:00.000Z');

    expect(await push(record)).toBe('applied');
    // Replaying the outbox after a dropped connection must be safe (§7).
    expect(await push(record)).toBe('duplicate');
    expect(await push(record)).toBe('duplicate');

    const rows = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.amount)).toBe(4500);

    // A replay writes no change, so it does not wake every other phone.
    const changes = await db
      .select()
      .from(schema.changes)
      .where(eq(schema.changes.entityId, id));
    expect(changes).toHaveLength(1);
  });
});

describe('two people editing the same record', () => {
  it('keeps the later edit and files the earlier one rather than dropping it', async () => {
    const id = uuidv7();
    await push(expense(id, 4500, '2026-02-27T10:00:00.000Z'), 'phone-a');

    // The son edits it a minute later.
    expect(await push(expense(id, 5000, '2026-02-27T10:01:00.000Z'), 'phone-b')).toBe('applied');

    const [row] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
    expect(Number(row!.amount)).toBe(5000);

    // The version it replaced is kept — last-write-wins throws something away,
    // and §2.7 says nothing is truly lost.
    const audit = await db
      .select()
      .from(schema.overwrites)
      .where(eq(schema.overwrites.entityId, id));
    expect(audit).toHaveLength(1);
    expect(audit[0]!.loser).toBe('stored');
    expect(Number((audit[0]!.losingPayload as { amount: string }).amount)).toBe(4500);
  });

  it('refuses a stale write, and keeps that too', async () => {
    const id = uuidv7();
    await push(expense(id, 5000, '2026-02-27T10:01:00.000Z'), 'phone-b');

    // A phone that was offline pushes an older edit of the same record.
    expect(await push(expense(id, 4500, '2026-02-27T10:00:00.000Z'), 'phone-a')).toBe('superseded');

    const [row] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
    expect(Number(row!.amount)).toBe(5000);

    const audit = await db
      .select()
      .from(schema.overwrites)
      .where(eq(schema.overwrites.entityId, id));
    expect(audit).toHaveLength(1);
    expect(audit[0]!.loser).toBe('incoming');
    expect(Number((audit[0]!.losingPayload as { amount: string }).amount)).toBe(4500);
  });

  it('leaves different records alone', async () => {
    const a = uuidv7();
    const b = uuidv7();
    await push(expense(a, 100, '2026-02-27T10:00:00.000Z'), 'phone-a');
    await push(expense(b, 200, '2026-02-27T10:00:00.000Z'), 'phone-b');

    expect(await db.select().from(schema.overwrites).where(eq(schema.overwrites.householdId, householdId)))
      .toHaveLength(0);
  });
});

describe('two phones pushing at the same moment', () => {
  it('gives every change a sequence number, with none skipped or repeated', async () => {
    const ids = Array.from({ length: 20 }, () => uuidv7());

    // Twenty writes racing from two devices at once.
    await Promise.all(
      ids.map((id, i) =>
        push(expense(id, 100 + i, `2026-02-27T10:00:${String(i).padStart(2, '0')}.000Z`),
          i % 2 === 0 ? 'phone-a' : 'phone-b'),
      ),
    );

    const changes = await db
      .select()
      .from(schema.changes)
      .where(eq(schema.changes.householdId, householdId));

    expect(changes).toHaveLength(20);
    const seqs = changes.map((c) => c.seq).sort((a, b) => a - b);
    expect(new Set(seqs).size).toBe(20);

    // Every record landed exactly once.
    const stored = await db
      .select()
      .from(schema.expenses)
      .where(eq(schema.expenses.householdId, householdId));
    expect(stored).toHaveLength(20);
  });

  it('never lets a puller step over a change it has not seen', async () => {
    // The failure this guards against: two writers take sequence numbers in one
    // order and commit in another, so a client that pulls in between skips one
    // forever. The household lock makes sequence order commit order.
    const first = Array.from({ length: 10 }, () => uuidv7());
    await Promise.all(
      first.map((id, i) => push(expense(id, i, `2026-02-27T11:00:${String(i).padStart(2, '0')}.000Z`))),
    );

    const seen = await db
      .select()
      .from(schema.changes)
      .where(eq(schema.changes.householdId, householdId));
    const cursor = Math.max(...seen.map((c) => c.seq));

    const second = Array.from({ length: 10 }, () => uuidv7());
    await Promise.all(
      second.map((id, i) => push(expense(id, i, `2026-02-27T12:00:${String(i).padStart(2, '0')}.000Z`))),
    );

    // Pulling from the old cursor returns exactly the second batch — nothing
    // missing, nothing repeated.
    const after = (
      await db.select().from(schema.changes).where(eq(schema.changes.householdId, householdId))
    ).filter((c) => c.seq > cursor);

    expect(after).toHaveLength(10);
    expect(new Set(after.map((c) => c.entityId))).toEqual(new Set(second));
  });
});

describe('household scoping', () => {
  it('ignores a household id sent by the client', async () => {
    const id = uuidv7();
    const otherHousehold = uuidv7();
    await db.insert(schema.households).values({ id: otherHousehold, name: 'Someone else' });

    const record = expense(id, 4500, '2026-02-27T10:00:00.000Z');
    // A phone claiming to write into another family's books.
    record.payload['householdId'] = otherHousehold;

    await push(record);

    const [row] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
    // The session's household wins; the body is not trusted (§6).
    expect(row!.householdId).toBe(householdId);
  });
});

describe('parents and children', () => {
  it('stores a lot against the consignment it belongs to', async () => {
    const entryId = uuidv7();
    const lotId = uuidv7();
    const at = '2026-03-14T10:00:00.000Z';

    await push({
      entity: 'inventoryEntries', entityId: entryId, updatedAt: at,
      payload: { id: entryId, householdId, storedOn: '2026-03-14', createdAt: at, updatedAt: at },
    });
    await push({
      entity: 'lots', entityId: lotId, updatedAt: at,
      payload: { id: lotId, householdId, entryId, lotNo: '91/251', createdAt: at, updatedAt: at },
    });

    const [lot] = await db.select().from(schema.lots).where(eq(schema.lots.id, lotId));
    expect(lot!.entryId).toBe(entryId);
  });
});
