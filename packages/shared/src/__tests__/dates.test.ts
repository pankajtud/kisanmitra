import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatRegisterDate,
  parseRegisterDate,
  relativeDayKey,
  toIsoDate,
} from '../domain/dates.js';

describe('date formatting', () => {
  it('shows the register format', () => {
    expect(formatRegisterDate('2025-02-27')).toBe('27/02/2025');
  });

  it('round-trips', () => {
    expect(parseRegisterDate('27/02/2025')).toBe('2025-02-27');
    expect(parseRegisterDate('7/2/2025')).toBe('2025-02-07');
  });

  it('uses local calendar parts, not UTC', () => {
    // 00:30 IST on the 27th is still the 26th in UTC. The register says 27.
    expect(toIsoDate(new Date(2025, 1, 27, 0, 30))).toBe('2025-02-27');
  });

  it('rejects impossible dates rather than rolling them over', () => {
    expect(parseRegisterDate('31/02/2025')).toBeNull();
    expect(parseRegisterDate('27-02-2025')).toBeNull();
    expect(parseRegisterDate('')).toBeNull();
  });

  it('walks days across a month boundary', () => {
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('labels today and yesterday', () => {
    expect(relativeDayKey('2025-02-27', '2025-02-27')).toBe('today');
    expect(relativeDayKey('2025-02-26', '2025-02-27')).toBe('yesterday');
    expect(relativeDayKey('2025-02-25', '2025-02-27')).toBeNull();
  });
});
