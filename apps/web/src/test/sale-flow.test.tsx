/**
 * Starting a sale from the sale screen rather than from a lot.
 *
 * The branch that matters: a crop that uses cold storage gets asked where it
 * came from, and answering "yes" must offer the lots that actually hold it —
 * not every lot, and not sold-out ones.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App.js';
import { db } from '../db/db.js';
import { setPin } from '../db/lock.js';
import { availableLots, saveEntry } from '../db/inventory.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';
import { listSeasonSales } from '../db/stock.js';

const PIN = '1234';

async function unlocked(user: ReturnType<typeof userEvent.setup>) {
  await setPin(PIN);
  render(<App />);
  await screen.findByRole('heading', { name: 'अपना पिन डालें' });
  for (const digit of PIN) await user.click(screen.getByRole('button', { name: digit }));
  await screen.findByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' });
}

/** A potato consignment across two lots in one cold store. */
async function storePotatoes(ctx: AppContext) {
  const crops = await db.crops.where('householdId').equals(ctx.householdId).toArray();
  const potato = crops.find((c) => c.usesColdStorage)!;
  const grades = await db.grades.where('householdId').equals(ctx.householdId).toArray();
  const mota = grades.find((g) => g.code === 'M')!;
  const gulla = grades.find((g) => g.code === 'G')!;
  const store = (await db.coldStores.where('householdId').equals(ctx.householdId).toArray())[0]!;

  await saveEntry(ctx, {
    khataId: null,
    cropId: potato.id,
    coldStoreId: store.id,
    storedOn: '2026-03-14',
    variety: '37-97',
    fieldId: null,
    notes: null,
    lots: [
      { lotNo: '91/251', roomRack: '2/14', packets: [{ gradeId: mota.id, packets: 10 }, { gradeId: gulla.id, packets: 83 }] },
      { lotNo: '95/71', roomRack: '3/2', packets: [{ gradeId: mota.id, packets: 71 }] },
    ],
  });

  return { potato, mota, gulla, store };
}

let ctx: AppContext;
beforeEach(async () => {
  ctx = await ensureSeeded();
});

describe('availableLots', () => {
  it('offers every lot that still holds packets', async () => {
    await storePotatoes(ctx);
    const lots = await availableLots(ctx.cropCycleId);

    expect(lots.map((l) => l.lot.lotNo).sort()).toEqual(['91/251', '95/71']);
    expect(lots.find((l) => l.lot.lotNo === '91/251')!.total).toBe(93);
  });

  it('narrows to one crop', async () => {
    const { potato } = await storePotatoes(ctx);
    const wheat = (await db.crops.where('householdId').equals(ctx.householdId).toArray()).find(
      (c) => !c.usesColdStorage,
    )!;

    expect(await availableLots(ctx.cropCycleId, { cropId: potato.id })).toHaveLength(2);
    expect(await availableLots(ctx.cropCycleId, { cropId: wheat.id })).toHaveLength(0);
  });

  it('drops a lot once everything in it is sold', async () => {
    const { mota } = await storePotatoes(ctx);
    const lots = await availableLots(ctx.cropCycleId);
    const single = lots.find((l) => l.lot.lotNo === '95/71')!;

    const { saveSale } = await import('../db/stock.js');
    await saveSale(ctx, single.lot.id, {
      soldOn: '2026-04-01', buyer: 'व्यापारी', notes: null, khataId: null,
      sharingMode: 'khata', cropId: null, fieldId: null,
      lines: [{ gradeId: mota.id, packets: 71, ratePerPacket: 900 }],
      quantity: null, unit: null, ratePerUnit: null, partnerName: null, partnerShare: null,
    });

    const after = await availableLots(ctx.cropCycleId);
    expect(after.map((l) => l.lot.lotNo)).toEqual(['91/251']);
  });
});

describe('recording a sale from the sale screen', () => {
  it('asks where potato came from, then sells out of a chosen lot', async () => {
    await storePotatoes(ctx);
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'बिक्री' }));
    await user.click(await screen.findByRole('button', { name: 'बिक्री दर्ज करें' }));

    // Potato uses cold storage, so the question appears.
    await user.click(await screen.findByRole('button', { name: 'आलू' }));
    await user.click(await screen.findByRole('button', { name: 'हां' }));

    // Only lots with packets left are offered, shown in the register notation.
    const lot = await screen.findByRole('button', { name: /91\/251/ });
    expect(screen.getByRole('button', { name: /95\/71/ })).toBeInTheDocument();
    await user.click(lot);

    // Grades from that lot, capped at what it holds.
    const stepper = await screen.findAllByRole('button', { name: /एक और/ });
    await user.click(stepper[0]!);

    await user.click(screen.getByRole('button', { name: 'बिक्री सेव करें' }));

    await waitFor(async () => {
      expect(await listSeasonSales(ctx.cropCycleId)).toHaveLength(1);
    });
    const [sale] = await listSeasonSales(ctx.cropCycleId);
    expect(sale!.lotId).not.toBeNull();
  });

  it('never asks the storage question for a crop that has no lots', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'बिक्री' }));
    await user.click(await screen.findByRole('button', { name: 'बिक्री दर्ज करें' }));
    await user.click(await screen.findByRole('button', { name: 'गेहूँ' }));

    // Wheat goes straight from the field, so it drops through to quantity.
    expect(screen.queryByRole('button', { name: 'हां' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/कितना बेचा/)).toBeInTheDocument();
  });

  it('records a field sale by quantity and rate', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'बिक्री' }));
    await user.click(await screen.findByRole('button', { name: 'बिक्री दर्ज करें' }));
    await user.click(await screen.findByRole('button', { name: 'गोभी' }));

    await user.type(await screen.findByLabelText(/कितना बेचा/), '12');
    await user.type(screen.getByLabelText(/भाव प्रति/), '5400');
    await user.click(screen.getByRole('button', { name: 'बिक्री सेव करें' }));

    await waitFor(async () => {
      expect(await listSeasonSales(ctx.cropCycleId)).toHaveLength(1);
    });
    const [sale] = await listSeasonSales(ctx.cropCycleId);
    expect(sale!.lotId).toBeNull();
    expect(sale!.quantity).toBe(12);
    expect(sale!.totalAmount).toBe(64800);
  });
});
