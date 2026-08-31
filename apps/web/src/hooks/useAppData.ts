import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db.js';
import { listColdStores } from '../db/coldStores.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';

/** Reference data and the current household, straight out of the local database. */
export interface AppBoot {
  ctx: AppContext | null;
  /** Set when the local database could not be opened or seeded. */
  error: Error | null;
  retry: () => void;
}

/**
 * Opens the local database and makes sure this household's reference data is
 * there.
 *
 * A failure here used to leave the app rendering nothing at all — a white
 * screen with no way to tell what went wrong, which is the worst thing a farmer
 * can be shown. The error is now carried out so the screen can say something.
 */
export function useAppContext(): AppBoot {
  const [ctx, setCtx] = useState<AppContext | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    ensureSeeded().then(
      (value) => {
        if (!cancelled) setCtx(value);
      },
      (cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ctx, error, retry: () => setAttempt((n) => n + 1) };
}

export function useCategories(householdId: string | undefined) {
  return useLiveQuery(
    async () =>
      householdId
        ? (await db.expenseCategories.where('householdId').equals(householdId).toArray()).sort(
            (a, b) => a.sortOrder - b.sortOrder,
          )
        : [],
    [householdId],
    [],
  );
}

export function useFields(householdId: string | undefined) {
  return useLiveQuery(
    async () =>
      householdId
        ? (await db.fields.where('householdId').equals(householdId).toArray())
            .filter((f) => f.archivedAt === null)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [householdId],
    [],
  );
}

export function useCrops(householdId: string | undefined) {
  return useLiveQuery(
    async () =>
      householdId
        ? (await db.crops.where('householdId').equals(householdId).toArray())
            .filter((c) => c.archivedAt === null)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [householdId],
    [],
  );
}

export function useGrades(householdId: string | undefined) {
  return useLiveQuery(
    async () =>
      householdId
        ? (await db.grades.where('householdId').equals(householdId).toArray()).sort(
            (a, b) => a.sortOrder - b.sortOrder,
          )
        : [],
    [householdId],
    [],
  );
}

export function useColdStores(householdId: string | undefined) {
  return useLiveQuery(
    async () => (householdId ? await listColdStores(householdId) : []),
    [householdId],
    [],
  );
}

export function useCropCycle(cropCycleId: string | undefined) {
  return useLiveQuery(
    async () => (cropCycleId ? await db.cropCycles.get(cropCycleId) : undefined),
    [cropCycleId],
  );
}
