/**
 * Cost sharing. A joint expense — a hired tractor, a shared pump, a truck to
 * the cold store — is paid in full by one household and split with a partner.
 *
 * Only the household's own portion is its cost. Every total in the app, and
 * eventually the cost-per-packet number in M7, must go through
 * `householdShare` rather than reading `amount` directly. That is the whole
 * point of recording the split.
 */

export interface ShareableExpense {
  amount: number | null;
  partnerShare?: number | string | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/**
 * What this expense actually cost the household.
 *
 * A partner share larger than the amount would mean the household paid a
 * negative sum, which is not a thing; it is clamped to zero rather than
 * quietly dragging the season total down.
 */
export function householdShare(expense: ShareableExpense): number {
  const amount = toNumber(expense.amount);
  const partner = toNumber(expense.partnerShare);
  return Math.max(0, Math.round((amount - partner) * 100) / 100);
}

/** True when a partner takes any part of this expense. */
export function isShared(expense: ShareableExpense): boolean {
  return toNumber(expense.partnerShare) > 0;
}

/**
 * The partner's cut as a whole-number percentage, for display beside the
 * amount. Returns null when nothing is shared, or when the amount is zero and
 * a percentage would be meaningless rather than merely unknown.
 */
export function partnerPercent(expense: ShareableExpense): number | null {
  const amount = toNumber(expense.amount);
  const partner = toNumber(expense.partnerShare);
  if (partner <= 0 || amount <= 0) return null;
  return Math.round((Math.min(partner, amount) / amount) * 100);
}

/**
 * The partner's share for a given percentage of an amount — behind the
 * one-tap "half" button on the expense form, so the common case of an even
 * split is a single press rather than mental arithmetic.
 */
export function shareForPercent(amount: number, percent: number): number {
  return Math.round(amount * (percent / 100) * 100) / 100;
}

/** Sums what the household itself paid across many expenses. */
export function totalHouseholdShare(expenses: readonly ShareableExpense[]): number {
  return Math.round(expenses.reduce((sum, e) => sum + householdShare(e), 0) * 100) / 100;
}
