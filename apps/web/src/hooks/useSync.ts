/**
 * Runs sync in the background and reports it honestly.
 *
 * Never a spinner that implies the user must wait (CLAUDE.md §7): every record
 * is already saved on the phone, and sync is something that happens afterwards.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { syncOnce, type SyncOutcome } from '../db/sync.js';

/** Often enough that a second phone feels current, rare enough to be invisible. */
const INTERVAL_MS = 60_000;

export interface SyncStatus {
  pending: number;
  last: SyncOutcome | null;
  running: boolean;
  syncNow: () => void;
}

export function useSync(enabled: boolean): SyncStatus {
  const [last, setLast] = useState<SyncOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);

  const run = useCallback(async () => {
    if (!enabled) return;
    setRunning(true);
    try {
      setLast(await syncOnce());
    } catch (cause) {
      setLast({ phase: 'failed', pushed: 0, pulled: 0, superseded: 0, error: String(cause) });
    } finally {
      setRunning(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void run();

    const timer = setInterval(() => void run(), INTERVAL_MS);
    // Coming back into signal is the moment worth catching, not a fixed clock.
    const onOnline = () => void run();
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, run]);

  return { pending, last, running, syncNow: () => void run() };
}
