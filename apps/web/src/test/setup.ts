import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeEach, vi } from 'vitest';
import { db } from '../db/db.js';

// jsdom ships no WebCrypto. Node's is real, so the PIN's PBKDF2 derivation and
// the receipt photo hash are exercised properly rather than stubbed out.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// jsdom ships no localStorage either. The app copes with that on its own — a
// phone in private mode still opens, it just cannot remember the PIN — but the
// tests need somewhere real to store one.
if (!globalThis.localStorage) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

/**
 * No test may reach the network. The app is offline-first, so signed-out with
 * an unreachable server is the correct default state to test in; a test that
 * wants sync stubs its own responses.
 */
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me')) return new Response(null, { status: 401 });
      return new Response(JSON.stringify({}), { status: 503 });
    }),
  );
});

beforeEach(async () => {
  vi.restoreAllMocks();
  // The previous test may still have a write in flight — the PIN's PBKDF2
  // check records a failed attempt after it resolves. Let those land before
  // wiping, or they reappear as state in the next test.
  await new Promise((resolve) => setTimeout(resolve, 0));
  localStorage.clear();
  await db.delete();
  await db.open();
});
