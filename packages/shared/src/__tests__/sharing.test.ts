import { describe, expect, it } from 'vitest';
import {
  householdShare,
  isShared,
  partnerPercent,
  shareForPercent,
  totalHouseholdShare,
} from '../domain/sharing.js';

describe('householdShare', () => {
  it('subtracts the partner portion', () => {
    expect(householdShare({ amount: 4500, partnerShare: 2250 })).toBe(2250);
  });

  it('is the whole amount when nothing is shared', () => {
    expect(householdShare({ amount: 4500 })).toBe(4500);
    expect(householdShare({ amount: 4500, partnerShare: null })).toBe(4500);
    expect(householdShare({ amount: 4500, partnerShare: 0 })).toBe(4500);
  });

  it('accepts the decimal strings Postgres numeric returns', () => {
    expect(householdShare({ amount: 900, partnerShare: '300.00' })).toBe(600);
  });

  it('never goes negative when a share is entered wrong', () => {
    expect(householdShare({ amount: 1000, partnerShare: 4000 })).toBe(0);
  });

  it('treats a draft with no amount as costing nothing yet', () => {
    expect(householdShare({ amount: null })).toBe(0);
  });

  it('does not accumulate floating point error', () => {
    expect(householdShare({ amount: 0.3, partnerShare: 0.1 })).toBe(0.2);
  });
});

describe('totalHouseholdShare', () => {
  it('sums only what the household itself paid', () => {
    const expenses = [
      { amount: 4500, partnerShare: 2250 }, // 2250 mine
      { amount: 1000 }, // 1000 mine
      { amount: 900, partnerShare: '300.00' }, // 600 mine
    ];
    expect(totalHouseholdShare(expenses)).toBe(3850);
  });

  it('is zero for no expenses', () => {
    expect(totalHouseholdShare([])).toBe(0);
  });
});

describe('partnerPercent', () => {
  it('reports the partner cut for display', () => {
    expect(partnerPercent({ amount: 4500, partnerShare: 2250 })).toBe(50);
    expect(partnerPercent({ amount: 9000, partnerShare: 3000 })).toBe(33);
  });

  it('is null when there is nothing to show', () => {
    expect(partnerPercent({ amount: 4500 })).toBeNull();
    expect(partnerPercent({ amount: 0, partnerShare: 100 })).toBeNull();
    expect(partnerPercent({ amount: null, partnerShare: 100 })).toBeNull();
  });

  it('caps at 100 rather than reporting an impossible share', () => {
    expect(partnerPercent({ amount: 1000, partnerShare: 4000 })).toBe(100);
  });
});

describe('shareForPercent', () => {
  it('backs the one-tap half split', () => {
    expect(shareForPercent(4500, 50)).toBe(2250);
    expect(shareForPercent(999, 50)).toBe(499.5);
    expect(shareForPercent(9000, 33)).toBe(2970);
  });
});

describe('isShared', () => {
  it('is true only when a partner actually takes a portion', () => {
    expect(isShared({ amount: 100, partnerShare: 50 })).toBe(true);
    expect(isShared({ amount: 100, partnerShare: 0 })).toBe(false);
    expect(isShared({ amount: 100 })).toBe(false);
  });
});
