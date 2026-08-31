/**
 * The PIN gate. It is the only thing standing between a picked-up phone and the
 * household's books, so its failure modes matter more than its happy path.
 */
import { describe, expect, it, vi } from 'vitest';
import { clearPin, isLockSet, setPin, unlock } from '../db/lock.js';

describe('the PIN gate', () => {
  it('is absent until one is set', async () => {
    expect(isLockSet()).toBe(false);
    // With no PIN configured the app must open, not refuse everyone.
    expect(await unlock('')).toEqual({ ok: true });
  });

  it('accepts the right PIN and rejects a wrong one', async () => {
    await setPin('1234');
    expect(isLockSet()).toBe(true);
    expect((await unlock('1234')).ok).toBe(true);
    expect((await unlock('9999')).ok).toBe(false);
  });

  it('never stores the PIN itself', async () => {
    await setPin('4821');
    const stored = localStorage.getItem('km.lock') ?? '';
    expect(stored).not.toContain('4821');
    // A salted hash, not the number.
    expect(JSON.parse(stored)).toMatchObject({
      salt: expect.any(String),
      hash: expect.any(String),
    });
  });

  it('salts, so two phones with the same PIN do not share a hash', async () => {
    await setPin('1111');
    const first = JSON.parse(localStorage.getItem('km.lock')!);
    await setPin('1111');
    const second = JSON.parse(localStorage.getItem('km.lock')!);
    expect(second.salt).not.toBe(first.salt);
    expect(second.hash).not.toBe(first.hash);
  });

  it('slows down after repeated wrong guesses', async () => {
    await setPin('1234');

    // The first few fat-fingered attempts are free.
    for (let i = 0; i < 3; i++) {
      expect((await unlock('0000')).waitSeconds).toBeUndefined();
    }

    const fourth = await unlock('0000');
    expect(fourth.ok).toBe(false);
    expect(fourth.waitSeconds).toBeGreaterThan(0);

    // While backed off, even the correct PIN waits.
    const during = await unlock('1234');
    expect(during.ok).toBe(false);
    expect(during.waitSeconds).toBeGreaterThan(0);
  });

  it('forgives once the right PIN goes in', async () => {
    vi.useFakeTimers();
    try {
      await setPin('1234');
      for (let i = 0; i < 4; i++) await unlock('0000');

      vi.setSystemTime(Date.now() + 120_000);
      expect((await unlock('1234')).ok).toBe(true);

      // The counter resets, so a later slip is free again.
      expect((await unlock('0000')).waitSeconds).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('removing the gate leaves the records reachable', async () => {
    await setPin('1234');
    clearPin();
    expect(isLockSet()).toBe(false);
    expect((await unlock('anything')).ok).toBe(true);
  });

  it('opens rather than trapping the user out when storage is unavailable', async () => {
    await setPin('1234');
    expect(isLockSet()).toBe(true);

    // A phone in private mode, or with site data blocked: reads throw.
    const getItem = vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      // The gate cannot be read, so it is not enforced — the household must
      // still reach its own records. Documented in db/lock.ts.
      expect(isLockSet()).toBe(false);
      expect((await unlock('wrong')).ok).toBe(true);
      expect(getItem).toHaveBeenCalled();
    } finally {
      getItem.mockRestore();
    }

    // Storage back: the gate is enforced again.
    expect(isLockSet()).toBe(true);
    expect((await unlock('wrong')).ok).toBe(false);
  });
});
