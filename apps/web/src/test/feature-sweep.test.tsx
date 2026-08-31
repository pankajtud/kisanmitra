/**
 * A walk through every screen the app has, in the order a user meets them.
 *
 * The point is coverage of *reachability*: a blank screen from a bad query or a
 * bad render is invisible to unit tests but is the worst failure a farmer can
 * hit, because there is nothing on screen to explain it. Each test here opens a
 * screen for real and asserts something rendered.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App.js';
import { db } from '../db/db.js';
import { setPin } from '../db/lock.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';
import { saveEntry } from '../db/inventory.js';
import { saveKhata } from '../db/khata.js';

const PIN = '1234';
type User = ReturnType<typeof userEvent.setup>;

async function unlocked(user: User) {
  await setPin(PIN);
  render(<App />);
  await screen.findByRole('heading', { name: 'अपना पिन डालें' });
  for (const digit of PIN) await user.click(screen.getByRole('button', { name: digit }));
  await screen.findByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' });
}

let ctx: AppContext;
beforeEach(async () => {
  ctx = await ensureSeeded();
});

describe('the lock', () => {
  it('refuses a wrong PIN and keeps the app shut', async () => {
    const user = userEvent.setup();
    await setPin(PIN);
    render(<App />);
    await screen.findByRole('heading', { name: 'अपना पिन डालें' });

    for (const digit of '9999') await user.click(screen.getByRole('button', { name: digit }));

    expect(await screen.findByRole('alert')).toHaveTextContent('पिन गलत है');
    expect(screen.queryByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' })).not.toBeInTheDocument();
  });

  it('asks a first-time user to create one', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'चार अंकों का पिन बनाएं' })).toBeInTheDocument();
  });
});

describe('every navigation destination opens', () => {
  it.each([
    ['खाते', 'सब खाते'],
    ['माल', 'माल'],
    ['बिक्री', 'इस सीजन की बिक्री'],
    ['खर्च', /इस सीजन का हिसाब/],
  ])('%s', async (tab, heading) => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: tab }));
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('gets back home from anywhere', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'माल' }));
    await screen.findByRole('heading', { name: 'माल' });
    await user.click(screen.getByRole('button', { name: 'घर' }));

    expect(await screen.findByRole('heading', { name: 'किसान मित्र' })).toBeInTheDocument();
  });
});

describe('khata screens', () => {
  it('opens a khata with partners and shows the settlement split', async () => {
    await saveKhata(ctx, {
      name: 'आलू 2025-26', cropId: null, season: '2025-26', openedOn: '2025-10-01',
      durationMonths: 5, notes: null,
      partners: [
        { name: 'आप', sharePercent: 50, isSelf: true },
        { name: 'राम सिंह', sharePercent: 50, isSelf: false },
      ],
    });

    const user = userEvent.setup();
    await unlocked(user);
    await user.click(screen.getByRole('button', { name: 'खाते' }));
    await user.click(await screen.findByRole('button', { name: /आलू 2025-26/ }));

    await screen.findByRole('heading', { name: 'आलू 2025-26' });
    expect(screen.getByText('किसका कितना')).toBeInTheDocument();
    expect(screen.getByText('राम सिंह')).toBeInTheDocument();
    // The season block the khata now carries.
    expect(screen.getByText('2025-26')).toBeInTheDocument();
  });

  it('settles a khata and makes it read-only', async () => {
    await saveKhata(ctx, {
      name: 'गेहूं', cropId: null, season: '2025-26', openedOn: '2025-10-01',
      durationMonths: 6, notes: null, partners: [],
    });

    const user = userEvent.setup();
    await unlocked(user);
    await user.click(screen.getByRole('button', { name: 'खाते' }));
    await user.click(await screen.findByRole('button', { name: /गेहूं/ }));

    await user.click(await screen.findByRole('button', { name: 'हिसाब करके बंद करें' }));
    await user.click(await screen.findByRole('button', { name: 'हिसाब करके बंद करें' }));

    expect(await screen.findByRole('button', { name: 'दोबारा खोलें' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'खर्च जोड़ें' })).not.toBeInTheDocument();
  });
});

describe('inventory screens', () => {
  async function stock() {
    const crops = await db.crops.where('householdId').equals(ctx.householdId).toArray();
    const grades = await db.grades.where('householdId').equals(ctx.householdId).toArray();
    const store = (await db.coldStores.where('householdId').equals(ctx.householdId).toArray())[0]!;
    return saveEntry(ctx, {
      khataId: null, cropId: crops.find((c) => c.usesColdStorage)!.id,
      coldStoreId: store.id, storedOn: '2026-03-14', variety: '37-97', fieldId: null, notes: null,
      lots: [{ lotNo: '91/251', roomRack: '2/14', packets: [{ gradeId: grades[0]!.id, packets: 111 }] }],
    });
  }

  it('lists a consignment and opens its detail', async () => {
    await stock();
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'माल' }));
    await user.click(await screen.findByRole('button', { name: /91\/251|आलू/ }));

    // The lot and its remaining packets in the register's notation.
    expect(await screen.findByText('91/251')).toBeInTheDocument();
    expect(screen.getAllByText(/111/).length).toBeGreaterThan(0);
  });

  it('opens the form for a new consignment', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'माल' }));
    await user.click(await screen.findByRole('button', { name: 'माल रखें' }));

    expect(await screen.findByRole('heading', { name: 'माल रखें' })).toBeInTheDocument();
    expect(screen.getByText('एक एंट्री सिर्फ एक कोल्ड स्टोर की होती है')).toBeInTheDocument();
  });
});

describe('settings screens', () => {
  it('opens settings and the field editor, and adds a field', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'सेटिंग' }));
    await user.click(await screen.findByRole('button', { name: 'खेत' }));

    // fieldUsage() runs here — it threw on an unindexed key before.
    await screen.findByRole('heading', { name: 'खेत' });
    expect(screen.getByText('Jaynagar')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/नया खेत जोड़ें/), 'नया खेत');
    await user.click(screen.getByRole('button', { name: 'नया खेत जोड़ें' }));

    await waitFor(async () => {
      const fields = await db.fields.where('householdId').equals(ctx.householdId).toArray();
      expect(fields.map((f) => f.name)).toContain('नया खेत');
    });
  });

  it('switches language and back', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'सेटिंग' }));
    await user.click(await screen.findByRole('button', { name: 'English' }));

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'हिन्दी' }));
    expect(await screen.findByRole('heading', { name: 'सेटिंग' })).toBeInTheDocument();
  });
});

describe('offline', () => {
  it('says so, and still lets the user work', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const user = userEvent.setup();
    await unlocked(user);

    expect(screen.getByText('इंटरनेट नहीं है — काम चलता रहेगा')).toBeInTheDocument();
    // Nothing is blocked by being offline.
    await user.click(screen.getByRole('button', { name: 'बिना फोटो के खर्च जोड़ें' }));
    expect(await screen.findByRole('heading', { name: 'नया खर्च' })).toBeInTheDocument();
  });
});
