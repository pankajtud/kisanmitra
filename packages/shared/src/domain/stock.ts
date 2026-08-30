/**
 * What is still in the cold store.
 *
 * Potatoes leave storage in instalments, not all at once (CLAUDE.md §6), so a
 * lot's remaining stock is its deposit minus every sale made against it, grade
 * by grade. This is the calculation the whole stock register hangs off: if it
 * is wrong, the farmer is told they have potatoes they have already sold.
 */
import type { LotBreakdownEntry } from './lot.js';

export interface GradePackets {
  gradeId: string;
  packets: number;
}

export interface RemainingByGrade {
  gradeId: string;
  /** Deposited into storage. */
  stored: number;
  /** Sold across every instalment so far. */
  sold: number;
  /** Still in the cold store. */
  remaining: number;
}

/**
 * Per-grade remaining stock for one lot.
 *
 * Grades appear in the result if they were ever stored *or* ever sold — a
 * grade sold but never recorded as stored shows a negative remainder rather
 * than being hidden, because that is a data-entry mistake the user needs to
 * see, not one for us to paper over.
 */
export function remainingByGrade(
  stored: readonly GradePackets[],
  sold: readonly GradePackets[],
): RemainingByGrade[] {
  const totals = new Map<string, { stored: number; sold: number }>();

  const bucket = (gradeId: string) => {
    let entry = totals.get(gradeId);
    if (!entry) {
      entry = { stored: 0, sold: 0 };
      totals.set(gradeId, entry);
    }
    return entry;
  };

  // A lot can hold more than one row per grade once sales are summed in, so
  // both sides accumulate rather than overwrite.
  for (const row of stored) bucket(row.gradeId).stored += row.packets;
  for (const row of sold) bucket(row.gradeId).sold += row.packets;

  return [...totals.entries()].map(([gradeId, { stored: s, sold: d }]) => ({
    gradeId,
    stored: s,
    sold: d,
    remaining: s - d,
  }));
}

/** Total packets still in storage for a lot. */
export function remainingTotal(
  stored: readonly GradePackets[],
  sold: readonly GradePackets[],
): number {
  return remainingByGrade(stored, sold).reduce((sum, row) => sum + row.remaining, 0);
}

/** True once every packet in the lot has been sold. */
export function isLotEmpty(
  stored: readonly GradePackets[],
  sold: readonly GradePackets[],
): boolean {
  return remainingTotal(stored, sold) <= 0;
}

/**
 * The most packets of one grade that can still be sold from a lot. Never
 * negative, so it can be handed straight to a stepper's maximum.
 */
export function sellablePackets(
  gradeId: string,
  stored: readonly GradePackets[],
  sold: readonly GradePackets[],
): number {
  const row = remainingByGrade(stored, sold).find((r) => r.gradeId === gradeId);
  return Math.max(0, row?.remaining ?? 0);
}

/**
 * Turns remaining stock into the register's composite notation by joining it to
 * grade codes — so a partly-sold lot renders in the same `121(10M+83G)` form as
 * a full one, which is the format that makes the screen legible to someone who
 * has kept the register by hand (§5).
 */
export function remainingBreakdown(
  remaining: readonly RemainingByGrade[],
  grades: readonly { id: string; code: string; sortOrder: number }[],
): LotBreakdownEntry[] {
  const entries: LotBreakdownEntry[] = [];
  for (const row of remaining) {
    const grade = grades.find((g) => g.id === row.gradeId);
    // A grade the household has no reference data for cannot be given a
    // register code, so it is left out rather than rendered as a blank.
    if (grade) {
      entries.push({ code: grade.code, packets: row.remaining, sortOrder: grade.sortOrder });
    }
  }
  return entries;
}
