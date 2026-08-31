import { describe, expect, it } from 'vitest';
import {
  expectedEnd,
  isOverdue,
  monthsBetween,
  seasonLabel,
  seasonStart,
} from '../domain/season.js';

describe('seasonLabel', () => {
  it('puts a date after the turnover into the season that starts that year', () => {
    expect(seasonLabel('2025-10-01')).toBe('2025-26');
    expect(seasonLabel('2025-12-31')).toBe('2025-26');
  });

  it('puts a date before the turnover into the season that started last year', () => {
    // The harvest in March 2026 belongs to the crop planted in late 2025.
    expect(seasonLabel('2026-03-14')).toBe('2025-26');
    expect(seasonLabel('2026-09-30')).toBe('2025-26');
  });

  it('rolls over on the turnover date itself', () => {
    expect(seasonLabel('2026-09-30')).toBe('2025-26');
    expect(seasonLabel('2026-10-01')).toBe('2026-27');
  });

  it('pads the second year across a century boundary', () => {
    expect(seasonLabel('2099-11-01')).toBe('2099-00');
  });

  it('honours a household that turns its year over elsewhere', () => {
    // A June start: April 2026 is still the 2025-26 season.
    expect(seasonLabel('2026-04-01', 5)).toBe('2025-26');
    expect(seasonLabel('2026-06-01', 5)).toBe('2026-27');
  });
});

describe('seasonStart', () => {
  it('is the first day of the season a date falls in', () => {
    expect(seasonStart('2026-03-14')).toBe('2025-10-01');
    expect(seasonStart('2025-11-02')).toBe('2025-10-01');
  });
});

describe('expectedEnd', () => {
  it('adds the intended duration to the opening date', () => {
    expect(expectedEnd('2025-10-01', 5)).toBe('2026-03-01');
    expect(expectedEnd('2025-11-15', 12)).toBe('2026-11-15');
  });

  it('clamps rather than rolling over a short month', () => {
    // A month after 31 January is the end of February, not the 3rd of March.
    expect(expectedEnd('2025-01-31', 1)).toBe('2025-02-28');
    expect(expectedEnd('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('is null when no duration was given', () => {
    expect(expectedEnd('2025-10-01', null)).toBeNull();
    expect(expectedEnd('2025-10-01', undefined)).toBeNull();
    expect(expectedEnd('2025-10-01', 0)).toBeNull();
  });
});

describe('monthsBetween', () => {
  it('counts whole months only', () => {
    expect(monthsBetween('2025-10-01', '2026-03-01')).toBe(5);
    expect(monthsBetween('2025-10-15', '2026-03-14')).toBe(4);
  });

  it('goes negative backwards', () => {
    expect(monthsBetween('2026-03-01', '2025-10-01')).toBe(-5);
  });
});

describe('isOverdue', () => {
  it('is true once a khata is past its intended close', () => {
    expect(isOverdue('2025-10-01', 5, '2026-03-02')).toBe(true);
  });

  it('is false on the closing day itself, and before it', () => {
    expect(isOverdue('2025-10-01', 5, '2026-03-01')).toBe(false);
    expect(isOverdue('2025-10-01', 5, '2026-01-01')).toBe(false);
  });

  it('is never overdue without an intended duration', () => {
    expect(isOverdue('2020-10-01', null, '2026-03-01')).toBe(false);
  });
});
