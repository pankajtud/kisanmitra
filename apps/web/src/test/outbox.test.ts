/**
 * The outbox. Named in CLAUDE.md §14 as a part that must have real tests, and
 * for good reason: it is the only thing standing between a week of offline work
 * and losing it.
 *
 * The rule it exists to keep: nothing is dropped, ever. A failure delays an
 * entry, it never discards one.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { retryDelayMs } from '@kisanmitra/shared';
import { db } from '../db/db.js';
import {
  backfillFromLocalRecords,
  defer,
  dueItems,
  enqueue,
  pendingCount,
  settle,
} from '../db/outbox.js';
import { saveExpense } from '../db/expenses.js';
import { saveKhata } from '../db/khata.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';

let ctx: AppContext;
beforeEach(async () => {
  ctx = await ensureSeeded();
  await db.outbox.clear();
});

describe('queuing', () => {
  it('queues a record with everything the server needs to apply it', async () => {
    await enqueue(null, 'expenses', { id: 'e1', updatedAt: '2026-02-27T10:00:00.000Z' });

    const [item] = await db.outbox.toArray();
    expect(item!.entity).toBe('expenses');
    expect(item!.entityId).toBe('e1');
    expect(item!.updatedAt).toBe('2026-02-27T10:00:00.000Z');
    expect(item!.attempts).toBe(0);
    expect(item!.nextAttemptAt).toBeNull();
  });

  it('drains in the order the farmer did things', async () => {
    for (const id of ['a', 'b', 'c', 'd']) {
      await enqueue(null, 'expenses', { id, updatedAt: '2026-02-27T10:00:00.000Z' });
    }

    // Ordered by the entry's own UUIDv7, which encodes when it was written — so
    // a parent is always sent before the child that references it.
    expect((await dueItems()).map((i) => i.entityId)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('every mutation queues itself', () => {
  it('queues an expense as it is saved', async () => {
    await saveExpense(ctx, {
      amount: 4500, spentOn: '2026-02-27', categoryId: null, fieldId: null,
      vendor: null, notes: null, entryMethod: 'manual', partnerName: null,
      partnerShare: null, khataId: null, sharingMode: 'khata', cropId: null,
      product: null, quantity: null, unit: null,
    });

    const items = await db.outbox.toArray();
    expect(items.filter((i) => i.entity === 'expenses')).toHaveLength(1);
  });

  it('queues a khata and each of its partners', async () => {
    await saveKhata(ctx, {
      name: 'आलू', cropId: null, fieldId: null, openedOn: '2025-10-01',
      durationMonths: 5, notes: null,
      partners: [
        { name: 'आप', sharePercent: 50, isSelf: true },
        { name: 'राम सिंह', sharePercent: 50, isSelf: false },
      ],
    });

    const items = await db.outbox.toArray();
    expect(items.filter((i) => i.entity === 'khatas')).toHaveLength(1);
    expect(items.filter((i) => i.entity === 'khataPartners')).toHaveLength(2);
  });

  it('queues a soft delete, so it reaches the other phones', async () => {
    const id = await saveExpense(ctx, {
      amount: 100, spentOn: '2026-02-27', categoryId: null, fieldId: null,
      vendor: null, notes: null, entryMethod: 'manual', partnerName: null,
      partnerShare: null, khataId: null, sharingMode: 'khata', cropId: null,
      product: null, quantity: null, unit: null,
    });
    await db.outbox.clear();

    const { deleteExpense } = await import('../db/expenses.js');
    await deleteExpense(id);

    const [item] = await db.outbox.toArray();
    expect(item!.entityId).toBe(id);
    // A delete is an upsert carrying deletedAt — never a removal (§2.7).
    expect(item!.payload['deletedAt']).not.toBeNull();
  });

  it('does not queue a draft expense, which has no amount yet', async () => {
    const { saveReceiptDraft } = await import('../db/expenses.js');
    await saveReceiptDraft(ctx, {
      blob: new Blob(['x']), width: 100, height: 100, hash: 'abc',
    });

    const items = await db.outbox.toArray();
    // The receipt goes; the draft is this phone's business until confirmed (§8.2).
    expect(items.map((i) => i.entity)).toEqual(['receipts']);
  });
});

describe('failure', () => {
  it('keeps a failed entry and makes it wait longer each time', async () => {
    await enqueue(null, 'expenses', { id: 'e1', updatedAt: '2026-02-27T10:00:00.000Z' });
    const [first] = await dueItems();

    await defer([first!], 'network down');
    const [afterOne] = await db.outbox.toArray();
    expect(afterOne!.attempts).toBe(1);
    expect(afterOne!.lastError).toBe('network down');

    await defer([afterOne!], 'network down');
    const [afterTwo] = await db.outbox.toArray();
    expect(afterTwo!.attempts).toBe(2);

    // Still queued. Nothing is dropped, ever.
    expect(await pendingCount()).toBe(1);
    expect(Date.parse(afterTwo!.nextAttemptAt!)).toBeGreaterThan(
      Date.parse(afterOne!.nextAttemptAt!),
    );
  });

  it('leaves a deferred entry out of the batch until its time comes', async () => {
    await enqueue(null, 'expenses', { id: 'e1', updatedAt: '2026-02-27T10:00:00.000Z' });
    const [item] = await dueItems();
    await defer([item!], 'offline');

    expect(await dueItems(200, Date.now())).toHaveLength(0);
    // ...and is picked up again once the wait is over.
    expect(await dueItems(200, Date.now() + 60_000)).toHaveLength(1);
  });

  it('backs off, but not forever', () => {
    expect(retryDelayMs(1)).toBe(1000);
    expect(retryDelayMs(2)).toBe(2000);
    expect(retryDelayMs(3)).toBe(4000);
    // A phone finding signal after an afternoon in a cold store must not
    // hammer the server, and must not wait a day either.
    expect(retryDelayMs(50)).toBe(300_000);
  });
});

describe('confirmation', () => {
  it('forgets an entry only once the server has taken it', async () => {
    await enqueue(null, 'expenses', { id: 'e1', updatedAt: '2026-02-27T10:00:00.000Z' });
    await enqueue(null, 'expenses', { id: 'e2', updatedAt: '2026-02-27T10:00:00.000Z' });

    const items = await dueItems();
    await settle([items[0]!.id]);

    const left = await db.outbox.toArray();
    expect(left).toHaveLength(1);
    expect(left[0]!.entityId).toBe('e2');
  });
});

describe('a household that used the app before there was a server', () => {
  it('queues everything already on the phone, so nothing is stranded', async () => {
    await saveExpense(ctx, {
      amount: 4500, spentOn: '2026-02-27', categoryId: null, fieldId: null,
      vendor: null, notes: null, entryMethod: 'manual', partnerName: null,
      partnerShare: null, khataId: null, sharingMode: 'khata', cropId: null,
      product: null, quantity: null, unit: null,
    });
    await db.outbox.clear();

    const queued = await backfillFromLocalRecords(ctx.householdId);
    expect(queued).toBeGreaterThan(0);

    const entities = new Set((await db.outbox.toArray()).map((i) => i.entity));
    expect(entities).toContain('expenses');
    // Reference data goes too, or the server would have nothing to resolve
    // categories and fields against.
    expect(entities).toContain('crops');
    expect(entities).toContain('fields');
    expect(entities).toContain('households');
  });

  it('does not queue the same record twice', async () => {
    await backfillFromLocalRecords(ctx.householdId);
    const first = await pendingCount();
    await backfillFromLocalRecords(ctx.householdId);
    expect(await pendingCount()).toBe(first);
  });
});
