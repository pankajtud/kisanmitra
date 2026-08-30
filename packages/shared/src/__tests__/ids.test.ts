import { describe, expect, it } from 'vitest';
import { isUuid, uuidv7, uuidv7Timestamp } from '../domain/ids.js';

describe('uuidv7', () => {
  it('produces a well-formed v7 uuid', () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('7'); // version
    expect('89ab').toContain(id[19]); // RFC 9562 variant
  });

  it('encodes the generation time', () => {
    const now = Date.now();
    expect(Math.abs(uuidv7Timestamp(uuidv7(now)) - now)).toBeLessThanOrEqual(1);
  });

  it('is unique and lexically sortable across a burst in one millisecond', () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice().sort()).toEqual(ids);
  });

  it('stays monotonic when the clock moves backwards', () => {
    const first = uuidv7(1_700_000_000_000);
    const second = uuidv7(1_600_000_000_000);
    expect(second > first).toBe(true);
  });
});
