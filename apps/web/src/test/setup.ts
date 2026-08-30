import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';
import { db } from '../db/db.js';

// jsdom has no crypto.subtle and no canvas, and the tests below do not exercise
// image encoding — that path is covered by hand on a real phone.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: { digest: async () => new Uint8Array(32).buffer },
    configurable: true,
  });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
  await db.open();
});
