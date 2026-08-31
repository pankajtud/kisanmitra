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

beforeEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await db.delete();
  await db.open();
});
