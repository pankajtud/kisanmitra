/**
 * Amounts are shown in Latin digits with Indian digit grouping and the rupee
 * symbol — `₹4,500` (CLAUDE.md §10). Devanagari numerals are slower to read on
 * a phone, so we do not use them even in the Hindi UI.
 *
 * Money is stored as a decimal string (Postgres `numeric`) and handled here in
 * whole paise as an integer, so no rupee amount is ever a float.
 */

const inr = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `4500` -> `'₹4,500'`. Paise are shown only when non-zero. */
export function formatRupees(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 100) / 100;
  return '₹' + (Number.isInteger(rounded) ? inr.format(rounded) : inrWithPaise.format(rounded));
}

/** Grouping without the symbol, for table columns that carry their own header. */
export function formatAmount(amount: number | string | null | undefined): string {
  const s = formatRupees(amount);
  return s ? s.slice(1) : '';
}

/**
 * Read an amount a user typed or spoke. Tolerates `₹`, commas, spaces and
 * Devanagari digits (a voice transcript or an IME can produce them).
 * Returns null rather than guessing.
 */
export function parseAmount(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;

  const latinised = input.replace(/[०-९]/g, (d) =>
    String(d.charCodeAt(0) - 0x0966),
  );
  const cleaned = latinised.replace(/[₹,\s]/g, '').replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Postgres `numeric` wants a string. Never hand it a float. */
export function toNumericString(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}
