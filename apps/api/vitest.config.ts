import { defineConfig } from 'vitest/config';

/**
 * These tests talk to a real Postgres. Sync correctness is about transactions,
 * advisory locks and a monotonic sequence — none of which a fake reproduces,
 * and all of which are exactly where the bugs would be.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Concurrent-writer tests share one database and must not interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
