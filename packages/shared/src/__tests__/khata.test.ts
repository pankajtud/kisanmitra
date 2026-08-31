import { describe, expect, it } from 'vitest';
import {
  entryShare,
  khataBalance,
  khataTitle,
  partnersAddUp,
  selfPercent,
  settlement,
  totalShare,
  type Partner,
} from '../domain/khata.js';

const solo: Partner[] = [];
const half: Partner[] = [
  { name: 'आप', sharePercent: 50, isSelf: true },
  { name: 'राम सिंह', sharePercent: 50, isSelf: false },
];
const thirds: Partner[] = [
  { name: 'आप', sharePercent: 34, isSelf: true },
  { name: 'राम सिंह', sharePercent: 33, isSelf: false },
  { name: 'श्याम लाल', sharePercent: 33, isSelf: false },
];

describe('selfPercent', () => {
  it('is the whole venture when there are no partners', () => {
    expect(selfPercent(solo)).toBe(100);
  });

  it('reads the household row', () => {
    expect(selfPercent(half)).toBe(50);
    expect(selfPercent(thirds)).toBe(34);
  });
});

describe('entryShare', () => {
  it('follows the khata split by default', () => {
    expect(entryShare({ amount: 4500 }, half)).toBe(2250);
    expect(entryShare({ amount: 4500, sharingMode: 'khata' }, half)).toBe(2250);
  });

  it('is the whole amount in a khata with no partners', () => {
    expect(entryShare({ amount: 4500 }, solo)).toBe(4500);
  });

  it('honours an entry the household paid alone inside a shared khata', () => {
    expect(entryShare({ amount: 4500, sharingMode: 'none' }, half)).toBe(4500);
  });

  it('honours a custom rupee split, ignoring the khata percentages', () => {
    expect(entryShare({ amount: 4500, sharingMode: 'custom', partnerShare: 1000 }, half)).toBe(3500);
  });

  it('never goes negative when a custom share is entered wrong', () => {
    expect(entryShare({ amount: 1000, sharingMode: 'custom', partnerShare: 4000 }, half)).toBe(0);
  });

  it('treats a draft with no amount as worth nothing yet', () => {
    expect(entryShare({ amount: null }, half)).toBe(0);
  });

  it('accepts the decimal strings Postgres numeric returns', () => {
    expect(entryShare({ amount: 900, sharingMode: 'custom', partnerShare: '300.00' }, half)).toBe(600);
  });
});

describe('khataBalance', () => {
  const expenses = [{ amount: 4500 }, { amount: 1000, sharingMode: 'none' as const }];
  const earnings = [{ amount: 20000 }];

  it('reports the venture and the household separately', () => {
    const balance = khataBalance(expenses, earnings, half);

    // The whole venture.
    expect(balance.grossExpenses).toBe(5500);
    expect(balance.grossEarnings).toBe(20000);
    expect(balance.grossBalance).toBe(14500);

    // The household: half of 4500, all of the 1000 it paid alone, half the income.
    expect(balance.expenses).toBe(3250);
    expect(balance.earnings).toBe(10000);
    expect(balance.balance).toBe(6750);
  });

  it('is the same both ways when nobody shares it', () => {
    const balance = khataBalance(expenses, earnings, solo);
    expect(balance.balance).toBe(balance.grossBalance);
    expect(balance.balance).toBe(14500);
  });

  it('goes negative when a khata has lost money', () => {
    expect(khataBalance([{ amount: 9000 }], [], solo).balance).toBe(-9000);
  });

  it('is zero for an empty khata', () => {
    const balance = khataBalance([], [], half);
    expect(balance.balance).toBe(0);
    expect(balance.expenseCount).toBe(0);
  });
});

describe('settlement', () => {
  it('splits the venture result by the agreed percentages', () => {
    const rows = settlement(half, 14500);
    expect(rows).toEqual([
      { name: 'आप', isSelf: true, sharePercent: 50, amount: 7250 },
      { name: 'राम सिंह', isSelf: false, sharePercent: 50, amount: 7250 },
    ]);
  });

  it('always adds back to the whole, absorbing rounding into the household row', () => {
    const rows = settlement(thirds, 100);
    const sum = rows.reduce((total, row) => total + row.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
    // 34/33/33 of 100 leaves a paisa of drift; it lands on the household.
    expect(rows.find((r) => r.isSelf)!.amount).toBe(34);
  });

  it('shares a loss as well as a profit', () => {
    const rows = settlement(half, -5000);
    expect(rows.every((row) => row.amount === -2500)).toBe(true);
  });

  it('gives the whole result to the household when there are no partners', () => {
    expect(settlement(solo, 14500)).toEqual([
      { name: '', isSelf: true, sharePercent: 100, amount: 14500 },
    ]);
  });
});

describe('partnersAddUp', () => {
  it('accepts a complete split', () => {
    expect(partnersAddUp(half)).toBe(true);
    expect(partnersAddUp(thirds)).toBe(true);
    expect(partnersAddUp(solo)).toBe(true);
  });

  it('rejects one that does not account for the whole venture', () => {
    expect(
      partnersAddUp([
        { name: 'आप', sharePercent: 50, isSelf: true },
        { name: 'राम', sharePercent: 30, isSelf: false },
      ]),
    ).toBe(false);
  });
});

describe('totalShare', () => {
  it('sums what the household is owed across mixed sharing modes', () => {
    expect(
      totalShare(
        [
          { amount: 1000 },
          { amount: 1000, sharingMode: 'none' },
          { amount: 1000, sharingMode: 'custom', partnerShare: 250 },
        ],
        half,
      ),
    ).toBe(2250);
  });
});

describe('khataTitle', () => {
  it('reads crop, partner, season', () => {
    expect(khataTitle({ crop: 'आलू', partners: half, season: '2025-26' })).toBe(
      'आलू - राम सिंह - 2025-26',
    );
  });

  it('names every partner but never the household itself', () => {
    expect(khataTitle({ crop: 'गेहूँ', partners: thirds, season: '2025-26' })).toBe(
      'गेहूँ - राम सिंह, श्याम लाल - 2025-26',
    );
  });

  it('drops the partner part when the khata is not shared', () => {
    expect(khataTitle({ crop: 'आलू', partners: solo, season: '2025-26' })).toBe('आलू - 2025-26');
    expect(khataTitle({ crop: 'आलू', season: '2025-26' })).toBe('आलू - 2025-26');
  });

  it('leaves out whatever is not filled in yet, rather than showing blanks', () => {
    expect(khataTitle({ season: '2025-26' })).toBe('2025-26');
    expect(khataTitle({ crop: 'आलू' })).toBe('आलू');
    expect(khataTitle({})).toBe('');
  });

  it('ignores a partner row with no name typed yet', () => {
    expect(
      khataTitle({
        crop: 'आलू',
        partners: [
          { name: 'आप', sharePercent: 50, isSelf: true },
          { name: '  ', sharePercent: 50, isSelf: false },
        ],
        season: '2025-26',
      }),
    ).toBe('आलू - 2025-26');
  });
});
