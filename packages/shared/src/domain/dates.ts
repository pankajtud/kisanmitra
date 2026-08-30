/**
 * Dates are shown as `27/02/2025`, matching the register (CLAUDE.md §10), and
 * stored as an ISO `YYYY-MM-DD` day string to match the Postgres `date` columns.
 *
 * Everything here works on local calendar parts. `Date#toISOString` is never
 * used on a calendar date — in IST it shifts the day backwards.
 */

/** `new Date()` -> `'2025-02-27'` in the device's own timezone. */
export function toIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(): string {
  return toIsoDate();
}

/** `'2025-02-27'` -> `'27/02/2025'`. Passes through anything unparseable. */
export function formatRegisterDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** `'27/02/2025'` -> `'2025-02-27'`. Returns null rather than guessing. */
export function parseRegisterDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(input);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const probe = new Date(year, month - 1, day);
  if (probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  return toIsoDate(probe);
}

/** Local midnight for an ISO day string, for date inputs and comparisons. */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Groups an expense list into date headings: 'आज', 'कल', or `27/02/2025`. */
export function relativeDayKey(iso: string, now: string = today()): 'today' | 'yesterday' | null {
  if (iso === now) return 'today';
  if (iso === addDays(now, -1)) return 'yesterday';
  return null;
}
