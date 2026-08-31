/**
 * Resolving what an entry is worth to the household.
 *
 * An entry set to `khata` inherits its khata's agreed percentages, so working
 * out a season total means knowing the partners of every khata involved — not
 * just reading `partner_share` off the row. Getting this wrong silently
 * overstates every headline figure, which is why it lives in one place that
 * both the expense and the sale side call.
 */
import { entryShare, type Partner, type SharingMode } from '@kisanmitra/shared';
import { db } from './db.js';

export type PartnersByKhata = Map<string, Partner[]>;

/** Every khata's partner list for a household, in one pass. */
export async function partnersByKhata(householdId: string): Promise<PartnersByKhata> {
  const khatas = await db.khatas.where('householdId').equals(householdId).toArray();
  const rows = await db.khataPartners.where('khataId').anyOf(khatas.map((k) => k.id)).toArray();

  const map: PartnersByKhata = new Map();
  for (const row of rows.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = map.get(row.khataId) ?? [];
    list.push({ name: row.name, sharePercent: row.sharePercent, isSelf: row.isSelf });
    map.set(row.khataId, list);
  }
  return map;
}

export interface ShareableRow {
  khataId: string | null;
  amount: number | null;
  sharingMode: string;
  partnerShare: number | null;
}

/**
 * What one row is worth to the household. A row with no khata, or one whose
 * khata has no partners, is worth its full amount.
 */
export function shareOf(row: ShareableRow, partners: PartnersByKhata): number {
  return entryShare(
    {
      amount: row.amount,
      sharingMode: row.sharingMode as SharingMode,
      partnerShare: row.partnerShare,
    },
    (row.khataId ? partners.get(row.khataId) : undefined) ?? [],
  );
}

export function sumShares(rows: readonly ShareableRow[], partners: PartnersByKhata): number {
  return Math.round(rows.reduce((sum, row) => sum + shareOf(row, partners), 0) * 100) / 100;
}
