/**
 * The paper register writes a lot's contents as `111(21H+83G+7K+10M)` — total,
 * then the per-grade breakdown. We store that normalised across `lot_grades`
 * rows and render it back through this one helper, everywhere a lot is shown
 * (CLAUDE.md §5). This format is what makes the screen legible to someone who
 * has kept the register by hand.
 */

export interface LotBreakdownEntry {
  /** Single-letter register code: 'M', 'G', 'H', 'K', 'B'. */
  code: string;
  packets: number;
  /** Grade sort order from household reference data. */
  sortOrder?: number;
}

export interface FormatLotBreakdownOptions {
  /**
   * Total packets, when the register records one independently of the
   * breakdown. Defaults to the sum of the breakdown.
   *
   * The register's own totals do not always equal the sum of their parts —
   * see docs/open-questions.md Q9. Until that is answered we sum.
   */
  total?: number;
  /** Render `0` grades too. Off by default: the register omits them. */
  includeZero?: boolean;
}

/**
 * `formatLotBreakdown([{code:'H',packets:21}, ...])` -> `'121(21H+83G+7K+10M)'`
 *
 * Grades are ordered by their household-configured `sortOrder`, then by code,
 * so the same lot always renders identically. Returns `'0'` for an empty lot.
 */
export function formatLotBreakdown(
  entries: readonly LotBreakdownEntry[],
  options: FormatLotBreakdownOptions = {},
): string {
  const shown = entries
    .filter((e) => (options.includeZero ? e.packets >= 0 : e.packets > 0))
    .slice()
    .sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.code.localeCompare(b.code),
    );

  const total = options.total ?? entries.reduce((sum, e) => sum + e.packets, 0);

  if (shown.length === 0) return String(total);
  return `${total}(${shown.map((e) => `${e.packets}${e.code}`).join('+')})`;
}

/** Total packets in a lot. */
export function totalPackets(entries: readonly LotBreakdownEntry[]): number {
  return entries.reduce((sum, e) => sum + e.packets, 0);
}

/**
 * Parse the register notation back into entries — for importing the existing
 * spreadsheet. Returns null if the string is not in the expected shape, so the
 * caller can fall back to storing it verbatim rather than guessing.
 */
export function parseLotBreakdown(
  input: string,
): { total: number; entries: LotBreakdownEntry[] } | null {
  const match = /^\s*(\d+)\s*\(([^)]*)\)\s*$/.exec(input);
  if (!match) return null;

  const entries: LotBreakdownEntry[] = [];
  for (const part of match[2]!.split('+')) {
    const m = /^\s*(\d+)\s*([A-Za-z]+)\s*$/.exec(part);
    if (!m) return null;
    entries.push({ code: m[2]!.toUpperCase(), packets: Number(m[1]) });
  }
  if (entries.length === 0) return null;

  return { total: Number(match[1]), entries };
}
