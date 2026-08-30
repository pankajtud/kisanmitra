import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db.js';
import { ensureSeeded, type AppContext } from '../db/seed.js';

/** Reference data and the current household, straight out of the local database. */
export function useAppContext(): AppContext | null {
  const [ctx, setCtx] = useState<AppContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureSeeded().then((value) => {
      if (!cancelled) setCtx(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ctx;
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
    async () =>
      householdId ? await db.coldStores.where('householdId').equals(householdId).toArray() : [],
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
