import { describe, expect, it } from 'vitest';
import { formatRupees, parseAmount, toNumericString } from '../domain/money.js';

describe('formatRupees', () => {
  it('uses Indian digit grouping', () => {
    expect(formatRupees(4500)).toBe('₹4,500');
    expect(formatRupees(125000)).toBe('₹1,25,000');
    expect(formatRupees(10000000)).toBe('₹1,00,00,000');
    expect(formatRupees(0)).toBe('₹0');
  });

  it('shows paise only when there are any', () => {
    expect(formatRupees(1250)).toBe('₹1,250');
    expect(formatRupees(1250.5)).toBe('₹1,250.50');
  });

  it('accepts the decimal strings Postgres numeric returns', () => {
    expect(formatRupees('4500.00')).toBe('₹4,500');
  });

  it('renders nothing for a draft with no amount yet', () => {
    expect(formatRupees(null)).toBe('');
    expect(formatRupees(undefined)).toBe('');
    expect(formatRupees('')).toBe('');
  });
});

describe('parseAmount', () => {
  it('reads what a user types', () => {
    expect(parseAmount('4500')).toBe(4500);
    expect(parseAmount('₹4,500')).toBe(4500);
    expect(parseAmount(' 4 500 ')).toBe(4500);
    expect(parseAmount('1250.50')).toBe(1250.5);
  });

  it('reads Devanagari digits from a voice transcript or IME', () => {
    expect(parseAmount('४५००')).toBe(4500);
  });

  it('returns null rather than guessing', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-100')).toBe(100); // the sign is stripped, not inferred
    expect(parseAmount(null)).toBeNull();
  });
});

describe('toNumericString', () => {
  it('never hands Postgres a float', () => {
    expect(toNumericString(4500)).toBe('4500.00');
    expect(toNumericString(0.1 + 0.2)).toBe('0.30');
  });
});
