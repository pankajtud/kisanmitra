/**
 * The expense entry flow — the one UI flow CLAUDE.md §14 asks for tests on.
 *
 * These run with no server and no network of any kind: nothing in M1 has a
 * fetch to stub, which is the property being protected.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App.js';
import { db } from '../db/db.js';
import { listExpenses, seasonTotal } from '../db/expenses.js';
import '../i18n/index.js';

async function enterAmount(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const digit of digits) {
    await user.click(screen.getByRole('button', { name: digit }));
  }
}

async function openManualEntry(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  const manual = await screen.findByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' });
  await user.click(manual);
  await screen.findByRole('heading', { name: 'नया खर्च' });
}

describe('adding an expense without a photo', () => {
  it('saves the amount, date and category to the local database', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '4500');
    await user.click(screen.getByRole('button', { name: 'बीज' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    // Lands on the season register, with the new row in it.
    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });

    const cycle = await db.cropCycles.toCollection().first();
    const rows = await listExpenses(cycle!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount).toBe(4500);
    expect(rows[0]!.status).toBe('confirmed');
    expect(rows[0]!.entryMethod).toBe('manual');
    // Never sent anywhere yet, and the row says so honestly (§7).
    expect(rows[0]!.syncState).toBe('pending');
    expect(rows[0]!.deletedAt).toBeNull();
  });

  it('shows the total with Indian digit grouping and the rupee symbol', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '125000');
    await user.click(screen.getByRole('button', { name: 'खाद' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    // Shown twice: the season total and the row itself.
    expect(await screen.findAllByText('₹1,25,000')).not.toHaveLength(0);
    expect(screen.queryByText('₹125000')).not.toBeInTheDocument();
  });

  it('refuses to save without an amount, and says which field is missing', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await user.click(screen.getByRole('button', { name: 'बीज' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('रुपये भरें');
    const cycle = await db.cropCycles.toCollection().first();
    expect(await listExpenses(cycle!.id)).toHaveLength(0);
  });

  it('refuses to save without a category', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '300');
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('किस चीज़ का खर्च है, वो चुनें');
  });

  it('defaults the date to today and records it as an ISO day', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    expect(screen.getByRole('button', { name: 'आज' })).toHaveAttribute('aria-pressed', 'true');

    await enterAmount(user, '90');
    await user.click(screen.getByRole('button', { name: 'मजदूरी' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    const cycle = await db.cropCycles.toCollection().first();
    const rows = await listExpenses(cycle!.id);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(rows[0]!.spentOn).toBe(expected);
  });
});

describe('the number pad', () => {
  it('will not let a second decimal point in, or more than two paise digits', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '12.505');
    await user.click(screen.getByRole('button', { name: '.' }));

    expect(screen.getByRole('status')).toHaveTextContent('12.50');
  });

  it('deletes one digit at a time', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '4500');
    await user.click(screen.getByRole('button', { name: 'एक अंक मिटाएं' }));

    expect(screen.getByRole('status')).toHaveTextContent('450');
  });
});

describe('editing and removing', () => {
  it('edits an existing expense in place, keeping its id', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '200');
    await user.click(screen.getByRole('button', { name: 'डीजल' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    const cycle = await db.cropCycles.toCollection().first();
    const [before] = await listExpenses(cycle!.id);

    await user.click(await screen.findByRole('button', { name: /डीजल/ }));
    await user.click(await screen.findByRole('button', { name: 'बदलें' }));
    await screen.findByRole('heading', { name: 'खर्च बदलें' });

    await user.click(screen.getByRole('button', { name: 'एक अंक मिटाएं' }));
    await user.click(screen.getByRole('button', { name: '9' }));
    await user.click(screen.getByRole('button', { name: 'बदलाव सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    const after = await listExpenses(cycle!.id);
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(before!.id);
    expect(after[0]!.amount).toBe(209);
  });

  it('removes an expense softly — the row stays with a deletedAt', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '75');
    await user.click(screen.getByRole('button', { name: 'भाड़ा' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    await user.click(await screen.findByRole('button', { name: /भाड़ा/ }));
    await user.click(await screen.findByRole('button', { name: 'हटाएं' }));
    await user.click(await screen.findByRole('button', { name: 'हां, हटाएं' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    const cycle = await db.cropCycles.toCollection().first();
    expect(await listExpenses(cycle!.id)).toHaveLength(0);

    // Nothing is ever truly removed (§2.7).
    const all = await db.expenses.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]!.deletedAt).not.toBeNull();
  });
});

describe('the empty state', () => {
  it('tells the user what to do next', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /इस सीजन का खर्च/ }));

    const empty = await screen.findByText('अभी कोई खर्च नहीं जुड़ा।');
    expect(empty).toBeInTheDocument();
    expect(screen.getByText('नीचे का बटन दबाकर पहली रसीद की फोटो लें।')).toBeInTheDocument();
  });
});

describe('reference data', () => {
  it('is seeded once, locally, with client-generated ids', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' });

    await waitFor(async () => {
      expect(await db.expenseCategories.count()).toBe(7);
    });
    expect(await db.grades.count()).toBe(5);
    expect(await db.fields.count()).toBe(7);
    expect(await db.households.count()).toBe(1);

    const household = await db.households.toCollection().first();
    // UUIDv7, generated on this device (§7).
    expect(household!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-/);
  });
});

describe('sharing an expense with a partner', () => {
  it('records the partner and counts only the household share in the season total', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '4500');
    await user.click(screen.getByRole('button', { name: 'बीज' }));

    await user.click(screen.getByRole('button', { name: 'साझेदार के साथ' }));
    await user.type(await screen.findByLabelText(/साझेदार का नाम/), 'राम सिंह');
    // One tap for the common even split, rather than mental arithmetic.
    await user.click(screen.getByRole('button', { name: 'आधा-आधा' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });

    const cycle = await db.cropCycles.toCollection().first();
    const rows = await listExpenses(cycle!.id);
    expect(rows[0]!.amount).toBe(4500);
    expect(rows[0]!.partnerName).toBe('राम सिंह');
    expect(rows[0]!.partnerShare).toBe(2250);

    // The season total is the household's own cost, not the billed amount.
    const summary = await seasonTotal(cycle!.id);
    expect(summary.total).toBe(2250);
    expect(summary.billed).toBe(4500);
  });

  it('refuses a share larger than the bill, which would make the cost negative', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '1000');
    await user.click(screen.getByRole('button', { name: 'खाद' }));
    await user.click(screen.getByRole('button', { name: 'साझेदार के साथ' }));
    await user.type(await screen.findByLabelText(/साझेदार का नाम/), 'श्याम');
    await user.type(screen.getByLabelText('उनका हिस्सा'), '4000');
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('हिस्सा कुल रकम से ज़्यादा'))).toBe(true);

    const cycle = await db.cropCycles.toCollection().first();
    expect(await listExpenses(cycle!.id)).toHaveLength(0);
  });

  it('will not save a share without saying who it is with', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '800');
    await user.click(screen.getByRole('button', { name: 'डीजल' }));
    await user.click(screen.getByRole('button', { name: 'साझेदार के साथ' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('साझेदार का नाम भरें'))).toBe(true);
  });

  it('leaves an unshared expense whole', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '600');
    await user.click(screen.getByRole('button', { name: 'मजदूरी' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    const cycle = await db.cropCycles.toCollection().first();
    const rows = await listExpenses(cycle!.id);
    expect(rows[0]!.partnerName).toBeNull();
    expect(rows[0]!.partnerShare).toBeNull();
    expect((await seasonTotal(cycle!.id)).total).toBe(600);
  });
});

describe('what an expense was for', () => {
  it('records the crop, the product and how much of it', async () => {
    const user = userEvent.setup();
    await openManualEntry(user);

    await enterAmount(user, '3000');
    await user.click(screen.getByRole('button', { name: 'डीजल' }));
    await user.click(screen.getByRole('button', { name: 'आलू' }));
    await user.type(screen.getByLabelText(/क्या खरीदा\?/), 'डीजल');
    await user.type(screen.getByLabelText(/कितना\?/), '60');
    await user.click(screen.getByRole('button', { name: 'लीटर' }));
    await user.click(screen.getByRole('button', { name: 'खर्च सेव करें' }));

    await screen.findByRole('heading', { name: /इस सीजन का हिसाब/ });
    const cycle = await db.cropCycles.toCollection().first();
    const rows = await listExpenses(cycle!.id);
    expect(rows[0]!.product).toBe('डीजल');
    expect(rows[0]!.quantity).toBe(60);
    expect(rows[0]!.unit).toBe('लीटर');
    expect(rows[0]!.cropId).not.toBeNull();
  });

  it('seeds the crops the household actually grows, not just potato', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' });
    await waitFor(async () => {
      expect(await db.crops.count()).toBe(6);
    });
    const names = (await db.crops.toArray()).map((c) => c.nameHi);
    expect(names).toContain('आलू');
    expect(names).toContain('गेहूं');
    // Only potato is graded into cold-storage lots.
    expect((await db.crops.toArray()).filter((c) => c.usesColdStorage)).toHaveLength(1);
  });
});
