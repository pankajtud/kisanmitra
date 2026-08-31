/**
 * A walk through every screen the app has, in the order a user meets them.
 *
 * The point is coverage of *reachability*: a blank screen from a bad query or a
 * bad render is invisible to unit tests but is the worst failure a farmer can
 * hit, because there is nothing on screen to explain it. Each test here opens a
 * screen for real and asserts something rendered.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
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
    // Stated rather than inherited: a test about first-run behaviour should set
    // up first-run state itself, not depend on another test's cleanup.
    const { clearPin } = await import('../db/lock.js');
    clearPin();

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
      name: 'आलू 2025-26', cropId: null, fieldId: null, openedOn: '2025-10-01',
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
      name: 'गेहूँ', cropId: null, fieldId: null, openedOn: '2025-10-01',
      durationMonths: 6, notes: null, partners: [],
    });

    const user = userEvent.setup();
    await unlocked(user);
    await user.click(screen.getByRole('button', { name: 'खाते' }));
    await user.click(await screen.findByRole('button', { name: /गेहूँ/ }));

    await user.click(await screen.findByRole('button', { name: 'हिसाब करके बंद करें' }));
    await user.click(await screen.findByRole('button', { name: 'हिसाब करके बंद करें' }));

    expect(await screen.findByRole('button', { name: 'दोबारा खोलें' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'खर्च जोड़ें' })).not.toBeInTheDocument();
  });
});

describe('year books', () => {
  it('opens the current year and keeps older ones shut until tapped', async () => {
    const { seasonLabel, today } = await import('@kisanmitra/shared');
    const thisSeason = seasonLabel(today());

    await saveKhata(ctx, {
      name: 'इस साल', cropId: null, fieldId: null, openedOn: today(),
      durationMonths: null, notes: null, partners: [],
    });
    await saveKhata(ctx, {
      name: 'पुराना साल', cropId: null, fieldId: null, openedOn: '2020-11-01',
      durationMonths: null, notes: null, partners: [],
    });

    const user = userEvent.setup();
    await unlocked(user);
    await user.click(screen.getByRole('button', { name: 'खाते' }));

    // Both covers are on screen...
    await screen.findByRole('button', { name: new RegExp(thisSeason) });
    const oldBook = screen.getByRole('button', { name: /2020-21/ });

    // ...but only this year's khatas are.
    expect(screen.getByRole('button', { name: /इस साल/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /पुराना साल/ })).not.toBeInTheDocument();
    expect(oldBook).toHaveAttribute('aria-expanded', 'false');

    await user.click(oldBook);
    expect(await screen.findByRole('button', { name: /पुराना साल/ })).toBeInTheDocument();
  });

  it('files a khata by its opening date, not the calendar year', async () => {
    // March belongs to the season that began the previous October.
    await saveKhata(ctx, {
      name: 'वसंत', cropId: null, fieldId: null, openedOn: '2026-03-14',
      durationMonths: null, notes: null, partners: [],
    });

    const user = userEvent.setup();
    await unlocked(user);
    await user.click(screen.getByRole('button', { name: 'खाते' }));

    expect(await screen.findByRole('button', { name: /2025-26/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /2026-27/ })).not.toBeInTheDocument();
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

  it('lists lots as register rows and opens the consignment behind one', async () => {
    await stock();
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'माल' }));

    // A table with the register's columns, one row per lot.
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'लॉट' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'बोरे' })).toBeInTheDocument();

    const lotCell = within(table).getByRole('button', { name: '91/251' });
    expect(within(table).getByText(/111/)).toBeInTheDocument();

    // Which cold store the produce sits in is shown on every row, whether the
    // household uses one store or several.
    expect(within(table).getByRole('columnheader', { name: 'स्टोर' })).toBeInTheDocument();
    expect(within(table).getByText('G.L. Cold Storage, Chitaura')).toBeInTheDocument();

    await user.click(lotCell);
    expect(await screen.findByText('2/14')).toBeInTheDocument();
    // And again on the consignment itself, as a labelled row.
    expect(screen.getByText('G.L. Cold Storage, Chitaura')).toBeInTheDocument();
  });

  it('shows a second store on the rows stored there', async () => {
    const { addColdStore } = await import('../db/coldStores.js');
    const sharma = (await addColdStore(ctx.householdId, 'Sharma Cold Storage'))!;
    const grades = await db.grades.where('householdId').equals(ctx.householdId).toArray();

    await stock();
    await saveEntry(ctx, {
      khataId: null, cropId: null, coldStoreId: sharma, storedOn: '2026-03-15',
      variety: null, fieldId: null, notes: null,
      lots: [{ lotNo: '77/40', roomRack: '1/1', packets: [{ gradeId: grades[0]!.id, packets: 40 }] }],
    });

    const user = userEvent.setup();
    await unlocked(user);
    await user.click(screen.getByRole('button', { name: 'माल' }));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Sharma Cold Storage')).toBeInTheDocument();
    expect(within(table).getByText('G.L. Cold Storage, Chitaura')).toBeInTheDocument();
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

describe('cold stores', () => {
  it('adds a second store from settings and offers it on a new consignment', async () => {
    const user = userEvent.setup();
    await unlocked(user);

    await user.click(screen.getByRole('button', { name: 'सेटिंग' }));
    await user.click(await screen.findByRole('button', { name: 'कोल्ड स्टोर' }));

    await user.type(screen.getByLabelText(/नया कोल्ड स्टोर जोड़ें/), 'Sharma Cold Storage');
    await user.click(screen.getByRole('button', { name: 'नया कोल्ड स्टोर जोड़ें' }));

    // G.L. stays the default; the new one sits alongside it.
    expect(await screen.findByText('Sharma Cold Storage')).toBeInTheDocument();
    expect(screen.getByText('डिफ़ॉल्ट')).toBeInTheDocument();

    await waitFor(async () => {
      const stores = await db.coldStores.where('householdId').equals(ctx.householdId).toArray();
      expect(stores).toHaveLength(2);
      expect(stores.filter((s) => s.isDefault)).toHaveLength(1);
    });
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

describe('when something breaks', () => {
  it('says so instead of showing a blank screen', async () => {
    // The failure the user hit: the database will not open, so the app context
    // never resolves. Previously this rendered nothing at all.
    // Dexie opens lazily on first use, so failing the first read is a truer
    // stand-in for a database that will not open than mocking open() itself.
    vi.spyOn(db.households, 'toCollection').mockImplementation(() => {
      throw new Error('VersionError: schema mismatch');
    });

    const user = userEvent.setup();
    await setPin(PIN);
    render(<App />);
    await screen.findByRole('heading', { name: 'अपना पिन डालें' });
    for (const digit of PIN) await user.click(screen.getByRole('button', { name: digit }));

    expect(await screen.findByRole('heading', { name: 'ऐप खुल नहीं पाया' })).toBeInTheDocument();
    // The detail is on screen so it can be read out to whoever can act on it.
    expect(screen.getByText(/schema mismatch/)).toBeInTheDocument();
    // And the reassurance that matters most.
    expect(screen.getByText(/कुछ मिटा नहीं है/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'फिर कोशिश करें' })).toBeInTheDocument();
  });
});
