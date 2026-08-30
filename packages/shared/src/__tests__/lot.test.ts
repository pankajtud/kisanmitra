import { describe, expect, it } from 'vitest';
import { formatLotBreakdown, parseLotBreakdown, totalPackets } from '../domain/lot.js';

/** Grade sort order as seeded from the register: M, G, H, K, B. */
const order: Record<string, number> = { M: 0, G: 1, H: 2, K: 3, B: 4 };
const g = (code: string, packets: number) => ({ code, packets, sortOrder: order[code] });

describe('formatLotBreakdown', () => {
  it('renders the register notation', () => {
    expect(formatLotBreakdown([g('M', 10), g('G', 83), g('H', 21), g('K', 7)])).toBe(
      '121(10M+83G+21H+7K)',
    );
  });

  it('orders grades by household sort order, not by insertion', () => {
    const a = formatLotBreakdown([g('K', 7), g('M', 10), g('H', 21), g('G', 83)]);
    const b = formatLotBreakdown([g('M', 10), g('G', 83), g('H', 21), g('K', 7)]);
    expect(a).toBe(b);
    expect(a).toBe('121(10M+83G+21H+7K)');
  });

  it('falls back to code order when no sort order is configured', () => {
    expect(formatLotBreakdown([{ code: 'K', packets: 7 }, { code: 'B', packets: 3 }])).toBe(
      '10(3B+7K)',
    );
  });

  it('omits zero-packet grades, because the register does', () => {
    expect(formatLotBreakdown([g('M', 40), g('H', 0), g('G', 11)])).toBe('51(40M+11G)');
  });

  it('includes zero-packet grades on request', () => {
    expect(formatLotBreakdown([g('M', 40), g('H', 0)], { includeZero: true })).toBe(
      '40(40M+0H)',
    );
  });

  it('renders a single grade without collapsing the notation', () => {
    expect(formatLotBreakdown([g('M', 71)])).toBe('71(71M)');
  });

  it('renders a bare total when there is nothing to break down', () => {
    expect(formatLotBreakdown([])).toBe('0');
    expect(formatLotBreakdown([g('M', 0)])).toBe('0');
  });

  it('honours an explicit total when the register records one', () => {
    // The register's totals do not always equal the sum of their parts.
    // See docs/open-questions.md Q9.
    expect(formatLotBreakdown([g('M', 10), g('G', 83), g('H', 21), g('K', 7)], { total: 111 }))
      .toBe('111(10M+83G+21H+7K)');
  });
});

describe('totalPackets', () => {
  it('sums the breakdown', () => {
    expect(totalPackets([g('M', 10), g('G', 83), g('H', 21), g('K', 7)])).toBe(121);
    expect(totalPackets([])).toBe(0);
  });
});

describe('parseLotBreakdown', () => {
  it('round-trips the notation', () => {
    const parsed = parseLotBreakdown('121(10M+83G+21H+7K)');
    expect(parsed).not.toBeNull();
    expect(parsed!.total).toBe(121);
    expect(formatLotBreakdown(parsed!.entries.map((e) => ({ ...e, sortOrder: order[e.code] })))).toBe(
      '121(10M+83G+21H+7K)',
    );
  });

  it('keeps a total that disagrees with its parts rather than correcting it', () => {
    const parsed = parseLotBreakdown('111(21H+83G+7K+10M)');
    expect(parsed!.total).toBe(111);
    expect(totalPackets(parsed!.entries)).toBe(121);
  });

  it('tolerates whitespace', () => {
    expect(parseLotBreakdown(' 30( 10M + 20G ) ')).toEqual({
      total: 30,
      entries: [
        { code: 'M', packets: 10 },
        { code: 'G', packets: 20 },
      ],
    });
  });

  it('returns null rather than guessing at anything unrecognised', () => {
    expect(parseLotBreakdown('91/251')).toBeNull();
    expect(parseLotBreakdown('111')).toBeNull();
    expect(parseLotBreakdown('111()')).toBeNull();
    expect(parseLotBreakdown('111(21)')).toBeNull();
    expect(parseLotBreakdown('')).toBeNull();
  });
});
