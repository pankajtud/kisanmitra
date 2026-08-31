/**
 * Seasons and durations.
 *
 * The farming year does not follow the calendar year: in this district it runs
 * roughly October to September, so a khata opened in March 2026 belongs to the
 * 2025-26 season, not to 2026. Writing "2026" on it would put it in the wrong
 * year's books.
 */
import { fromIsoDate, toIsoDate } from './dates.js';

/**
 * Month the farming year turns over, zero-based. October.
 *
 * ASSUMPTION, not confirmed — see docs/open-questions.md Q10. It is one
 * constant, so correcting it is a one-line change.
 */
export const SEASON_START_MONTH = 9;

/** `'2026-03-14'` -> `'2025-26'`. */
export function seasonLabel(iso: string, startMonth = SEASON_START_MONTH): string {
  const date = fromIsoDate(iso);
  const startYear = date.getMonth() >= startMonth ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** First day of the season a date falls in. */
export function seasonStart(iso: string, startMonth = SEASON_START_MONTH): string {
  const date = fromIsoDate(iso);
  const startYear = date.getMonth() >= startMonth ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
}

/**
 * When a khata is meant to close: its opening date plus its intended duration.
 *
 * Month arithmetic clamps rather than rolling over — 31 January plus one month
 * is the last day of February, not the third of March, which is what a person
 * means by "a month later".
 */
export function expectedEnd(openedOn: string, months: number | null | undefined): string | null {
  if (months === null || months === undefined || months <= 0) return null;

  const start = fromIsoDate(openedOn);
  const day = start.getDate();
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));

  return toIsoDate(target);
}

/**
 * Whole months from one day to another, negative when the second is earlier.
 * Used to tell a farmer a khata is running past its season.
 */
export function monthsBetween(fromIso: string, toIso: string): number {
  const from = fromIsoDate(fromIso);
  const to = fromIsoDate(toIso);
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/** True once a khata is past the date it was meant to close. */
export function isOverdue(
  openedOn: string,
  months: number | null | undefined,
  todayIso: string,
): boolean {
  const end = expectedEnd(openedOn, months);
  return end !== null && todayIso > end;
}
