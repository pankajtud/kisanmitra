import { describe, expect, it } from 'vitest';
import { formatLotBreakdown } from '../domain/lot.js';
import {
  isLotEmpty,
  remainingBreakdown,
  remainingByGrade,
  remainingTotal,
  sellablePackets,
} from '../domain/stock.js';

/** Grade ids as they would come from household reference data. */
const M = 'grade-m';
const G = 'grade-g';
const H = 'grade-h';
const GRADES = [
  { id: M, code: 'M', sortOrder: 0 },
  { id: G, code: 'G', sortOrder: 1 },
  { id: H, code: 'H', sortOrder: 2 },
];

/** A lot deposited as 121(10M+83G+21H+7K) minus the K, for brevity. */
const stored = [
  { gradeId: M, packets: 10 },
  { gradeId: G, packets: 83 },
  { gradeId: H, packets: 21 },
];

describe('remainingByGrade', () => {
  it('is the full deposit before anything is sold', () => {
    const rows = remainingByGrade(stored, []);
    expect(rows.find((r) => r.gradeId === G)).toEqual({
      gradeId: G,
      stored: 83,
      sold: 0,
      remaining: 83,
    });
  });

  it('subtracts sales grade by grade, not from a single pool', () => {
    const sold = [
      { gradeId: G, packets: 30 },
      { gradeId: M, packets: 4 },
    ];
    const rows = remainingByGrade(stored, sold);

    expect(rows.find((r) => r.gradeId === G)!.remaining).toBe(53);
    expect(rows.find((r) => r.gradeId === M)!.remaining).toBe(6);
    // Untouched by a sale of other grades.
    expect(rows.find((r) => r.gradeId === H)!.remaining).toBe(21);
  });

  it('sums instalments, because potatoes leave storage a few at a time', () => {
    const sold = [
      { gradeId: G, packets: 20 },
      { gradeId: G, packets: 15 },
      { gradeId: G, packets: 8 },
    ];
    expect(remainingByGrade(stored, sold).find((r) => r.gradeId === G)!.remaining).toBe(40);
  });

  it('surfaces an over-sale as negative rather than hiding it', () => {
    // Selling 90 of a grade that only had 83 stored is a data-entry mistake the
    // user needs to see.
    const rows = remainingByGrade(stored, [{ gradeId: G, packets: 90 }]);
    expect(rows.find((r) => r.gradeId === G)!.remaining).toBe(-7);
  });

  it('includes a grade that was sold but never stored', () => {
    const rows = remainingByGrade(stored, [{ gradeId: 'grade-k', packets: 5 }]);
    const kirri = rows.find((r) => r.gradeId === 'grade-k');
    expect(kirri).toEqual({ gradeId: 'grade-k', stored: 0, sold: 5, remaining: -5 });
  });
});

describe('remainingTotal', () => {
  it('counts what is still in the cold store', () => {
    expect(remainingTotal(stored, [])).toBe(114);
    expect(remainingTotal(stored, [{ gradeId: G, packets: 83 }])).toBe(31);
  });
});

describe('isLotEmpty', () => {
  it('is false while anything remains', () => {
    expect(isLotEmpty(stored, [{ gradeId: G, packets: 83 }])).toBe(false);
  });

  it('is true once every grade is sold out', () => {
    const sold = [
      { gradeId: M, packets: 10 },
      { gradeId: G, packets: 83 },
      { gradeId: H, packets: 21 },
    ];
    expect(isLotEmpty(stored, sold)).toBe(true);
  });

  it('is true for a lot that was never stocked', () => {
    expect(isLotEmpty([], [])).toBe(true);
  });
});

describe('sellablePackets', () => {
  it('caps what a sale can take from a grade', () => {
    expect(sellablePackets(G, stored, [{ gradeId: G, packets: 30 }])).toBe(53);
  });

  it('is zero, never negative, so it can drive a stepper maximum', () => {
    expect(sellablePackets(G, stored, [{ gradeId: G, packets: 200 }])).toBe(0);
    expect(sellablePackets('grade-unknown', stored, [])).toBe(0);
  });
});

describe('remainingBreakdown', () => {
  it('renders a partly-sold lot in the register notation', () => {
    const remaining = remainingByGrade(stored, [{ gradeId: H, packets: 21 }]);
    const entries = remainingBreakdown(remaining, GRADES);

    // The sold-out grade drops out of the notation, exactly as the register omits it.
    expect(formatLotBreakdown(entries)).toBe('93(10M+83G)');
  });

  it('renders a full lot the same way as a fresh deposit', () => {
    const entries = remainingBreakdown(remainingByGrade(stored, []), GRADES);
    expect(formatLotBreakdown(entries)).toBe('114(10M+83G+21H)');
  });

  it('drops grades the household has no reference data for', () => {
    const remaining = remainingByGrade([{ gradeId: 'ghost', packets: 5 }], []);
    expect(remainingBreakdown(remaining, GRADES)).toEqual([]);
  });
});
