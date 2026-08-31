/**
 * A खाता is the record for one venture — usually one crop for one season. Every
 * expense and every earning belongs to exactly one, and the khata is what gets
 * settled: partners square up against its balance and it is closed.
 *
 * Sharing works in two layers. The khata carries the agreed percentages, which
 * is how a partnership is actually agreed ("half and half"). An individual
 * entry that departs from the agreement overrides in rupees on the row itself,
 * because a receipt is split by amount, not by proportion.
 */

export type SharingMode = 'khata' | 'none' | 'custom';

export interface Partner {
  name: string;
  /** 0..100. The household's own row is `isSelf`. */
  sharePercent: number | string;
  isSelf: boolean;
}

export interface ShareableEntry {
  amount: number | null;
  sharingMode?: SharingMode | null;
  partnerShare?: number | string | null;
}

function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The household's own percentage of a khata. 100 when it has no partners. */
export function selfPercent(partners: readonly Partner[]): number {
  if (partners.length === 0) return 100;
  const self = partners.find((p) => p.isSelf);
  return self ? num(self.sharePercent) : 100;
}

/**
 * What one entry is worth to the household.
 *
 * `none` and `custom` are decisions the user made on the entry itself and
 * always win; `khata` falls back to the agreed split. Clamped at zero, because
 * a partner share larger than the amount would otherwise drag a total down
 * rather than showing up as the data-entry mistake it is.
 */
export function entryShare(entry: ShareableEntry, partners: readonly Partner[]): number {
  const amount = num(entry.amount);
  if (amount === 0) return 0;

  switch (entry.sharingMode ?? 'khata') {
    case 'none':
      return round2(amount);
    case 'custom':
      return round2(Math.max(0, amount - num(entry.partnerShare)));
    case 'khata':
    default:
      return round2(amount * (selfPercent(partners) / 100));
  }
}

export function totalShare(
  entries: readonly ShareableEntry[],
  partners: readonly Partner[],
): number {
  return round2(entries.reduce((sum, entry) => sum + entryShare(entry, partners), 0));
}

export interface KhataBalance {
  /** Full face value of everything recorded, before any split. */
  grossEarnings: number;
  grossExpenses: number;
  grossBalance: number;
  /** The household's own portion. This is what its books should say. */
  earnings: number;
  expenses: number;
  balance: number;
  earningCount: number;
  expenseCount: number;
}

/**
 * The bottom line of a khata, both ways: what the venture made in total, and
 * what the household's share of it is. Both are shown because a partner asking
 * "what did we make?" and the household asking "what did I make?" are different
 * questions with different answers.
 */
export function khataBalance(
  expenses: readonly ShareableEntry[],
  earnings: readonly ShareableEntry[],
  partners: readonly Partner[],
): KhataBalance {
  const grossEarnings = round2(earnings.reduce((sum, e) => sum + num(e.amount), 0));
  const grossExpenses = round2(expenses.reduce((sum, e) => sum + num(e.amount), 0));
  const ownEarnings = totalShare(earnings, partners);
  const ownExpenses = totalShare(expenses, partners);

  return {
    grossEarnings,
    grossExpenses,
    grossBalance: round2(grossEarnings - grossExpenses),
    earnings: ownEarnings,
    expenses: ownExpenses,
    balance: round2(ownEarnings - ownExpenses),
    earningCount: earnings.length,
    expenseCount: expenses.length,
  };
}

export interface PartnerSettlement {
  name: string;
  isSelf: boolean;
  sharePercent: number;
  /** Their slice of the venture's net result. Negative means the venture lost money. */
  amount: number;
}

/**
 * Who gets what when the khata is closed.
 *
 * Deliberately computed from the *gross* balance and the agreed percentages,
 * not from the per-entry shares: settlement is the partnership agreement being
 * honoured, and per-entry overrides are already reflected in the gross figures
 * both partners can see.
 *
 * Rounding is absorbed by the household's own row so the parts always add back
 * to the whole — a settlement that is fifty paise short invites an argument.
 */
export function settlement(
  partners: readonly Partner[],
  grossBalance: number,
): PartnerSettlement[] {
  if (partners.length === 0) {
    return [{ name: '', isSelf: true, sharePercent: 100, amount: round2(grossBalance) }];
  }

  const rows = partners.map((partner) => ({
    name: partner.name,
    isSelf: partner.isSelf,
    sharePercent: num(partner.sharePercent),
    amount: round2(grossBalance * (num(partner.sharePercent) / 100)),
  }));

  const drift = round2(grossBalance - rows.reduce((sum, row) => sum + row.amount, 0));
  if (drift !== 0) {
    const own = rows.find((row) => row.isSelf) ?? rows[0];
    if (own) own.amount = round2(own.amount + drift);
  }
  return rows;
}

/** Percentages must account for the whole venture, or the settlement is wrong. */
export function partnersAddUp(partners: readonly Partner[]): boolean {
  if (partners.length === 0) return true;
  return Math.abs(partners.reduce((sum, p) => sum + num(p.sharePercent), 0) - 100) < 0.01;
}

/**
 * A khata's name: crop, then who shares it, then the season —
 * `आलू - राम सिंह - 2025-26`.
 *
 * Built from the parts rather than typed, because a farmer running four khatas
 * needs to tell them apart at a glance in a list, and the three things that
 * distinguish them are exactly these. Parts that are not known yet are left
 * out rather than shown as blanks, so a half-filled form still reads sensibly.
 *
 * The household's own row is never named: every khata includes them, so it
 * carries no information.
 */
export function khataTitle({
  crop,
  partners,
  season,
}: {
  crop?: string | null;
  partners?: readonly Partner[];
  season?: string | null;
}): string {
  const others = (partners ?? [])
    .filter((partner) => !partner.isSelf)
    .map((partner) => partner.name.trim())
    .filter(Boolean);

  return [crop?.trim(), others.join(', ') || null, season?.trim()]
    .filter((part): part is string => Boolean(part))
    .join(' - ');
}
