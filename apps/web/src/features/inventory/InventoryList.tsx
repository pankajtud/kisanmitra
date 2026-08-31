import { useLiveQuery } from 'dexie-react-hooks';
import { formatLotBreakdown, formatRegisterDate, seasonLabel, today } from '@kisanmitra/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavTab } from '../../components/BottomNav.js';
import { Screen } from '../../components/Screen.js';
import { EmptyState } from '../../components/ui.js';
import { stockYearBooks, type StockRow } from '../../db/inventory.js';
import type { AppContext } from '../../db/seed.js';
import { useColdStores, useFields, useGrades } from '../../hooks/useAppData.js';

/**
 * The stock register: one dense line per lot, the way the paper book is written
 * (CLAUDE.md §9), gathered into a book per year like the khatas.
 *
 * A card per consignment was several lines tall and made four lots fill the
 * screen. This is a table — columns, one row per lot, scannable down the page —
 * with the lot number pinned to the left so it stays readable while the rest
 * scrolls sideways.
 *
 * Colour carries meaning rather than decoration: green still full, amber part
 * sold, grey sold out. That is the question a farmer opens this screen to ask.
 */
export function InventoryList({
  ctx,
  onOpen,
  onNew,
  onNavigate,
}: {
  ctx: AppContext;
  onOpen: (entryId: string) => void;
  onNew: () => void;
  onNavigate: (tab: NavTab) => void;
}) {
  const { t } = useTranslation();
  const grades = useGrades(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const stores = useColdStores(ctx.householdId);

  const books = useLiveQuery(
    () => stockYearBooks(ctx.householdId, grades),
    [ctx.householdId, grades],
  );

  const currentSeason = seasonLabel(today());
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const isOpen = (season: string) => opened[season] ?? season === currentSeason;

  const fieldName = (id: string | null) => fields.find((f) => f.id === id)?.name ?? '—';
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name ?? '—';

  return (
    <Screen
      title={t('inventory.title')}
      tab="inventory"
      onNavigate={onNavigate}
      action={
        <button type="button" onClick={onNew} className="btn-primary w-full text-xl">
          {t('inventory.new')}
        </button>
      }
    >
      {books === undefined ? null : books.length === 0 ? (
        <EmptyState title={t('inventory.empty')} action={t('inventory.emptyAction')} />
      ) : (
        <div className="flex flex-col gap-4">
          {books.map((book) => {
            const open = isOpen(book.season);
            return (
              <section key={book.season}>
                <button
                  type="button"
                  onClick={() => setOpened((o) => ({ ...o, [book.season]: !open }))}
                  aria-expanded={open}
                  className="card-tap mb-2 w-full px-4 py-3"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="tabular block text-xl font-bold">
                        {t('inventory.yearBook', { season: book.season })}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {t('inventory.entryCount', { count: book.entryCount })} ·{' '}
                        {t('inventory.lotCount', { count: book.rows.length })}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular text-right">
                        <span className="block text-2xl font-bold text-brand">{book.remaining}</span>
                        <span className="block text-xs text-ink-soft">/ {book.stored}</span>
                      </span>
                      <Chevron open={open} />
                    </span>
                  </span>
                </button>

                {open ? (
                  <>
                    {/* Wide content scrolls inside its own container; the page
                        itself never scrolls sideways (§10). */}
                    <div className="card overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b-2 border-line bg-sunk">
                            <Th sticky>{t('inventory.colLot')}</Th>
                            <Th>{t('inventory.colPackets')}</Th>
                            <Th>{t('inventory.colRack')}</Th>
                            <Th>{t('inventory.colVariety')}</Th>
                            <Th>{t('inventory.colField')}</Th>
                            <Th>{t('inventory.colStore')}</Th>
                            <Th>{t('inventory.colDate')}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {book.rows.map((row, index) => (
                            <Row
                              key={row.lot.id}
                              row={row}
                              zebra={index % 2 === 1}
                              onClick={() => onOpen(row.entry.id)}
                              fieldName={fieldName(row.entry.fieldId)}
                              storeName={storeName(row.entry.coldStoreId)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 px-1 text-xs text-ink-soft">{t('inventory.legend')}</p>
                  </>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

function Th({ children, sticky = false }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-2 py-2 text-xs font-bold whitespace-nowrap text-ink-soft ${
        sticky ? 'sticky left-0 bg-sunk' : ''
      }`}
    >
      {children}
    </th>
  );
}

/** Tint by how much of the lot is left — the reason to look at this screen. */
const TINT = {
  full: 'bg-credit-tint',
  partial: 'bg-accent-tint',
  soldOut: 'bg-sunk text-ink-soft',
} as const;

function Row({
  row,
  zebra,
  onClick,
  fieldName,
  storeName,
}: {
  row: StockRow;
  zebra: boolean;
  onClick: () => void;
  fieldName: string;
  storeName: string;
}) {
  const { t } = useTranslation();

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-b border-line last:border-0 active:bg-brand-tint ${
        zebra ? 'bg-black/[0.015]' : ''
      }`}
    >
      <th
        scope="row"
        className={`tabular sticky left-0 px-2 py-2 text-left font-bold whitespace-nowrap ${
          TINT[row.status]
        }`}
      >
        {/* The row is tappable; the button carries the accessible action. */}
        <button type="button" onClick={onClick} className="text-left">
          {row.lot.lotNo}
        </button>
      </th>

      <td className="tabular px-2 py-2 font-semibold whitespace-nowrap">
        {row.status === 'soldOut' ? (
          <span className="text-ink-soft">{t('inventory.soldOut')}</span>
        ) : (
          <span className={row.status === 'partial' ? 'text-accent' : 'text-credit'}>
            {formatLotBreakdown(row.breakdown)}
            {row.status === 'partial' ? (
              <span className="ml-1 text-xs text-ink-soft">/ {row.stored}</span>
            ) : null}
          </span>
        )}
      </td>

      <td className="tabular px-2 py-2 whitespace-nowrap">{row.lot.roomRack ?? '—'}</td>
      <td className="tabular px-2 py-2 whitespace-nowrap">{row.entry.variety ?? '—'}</td>
      <td className="px-2 py-2 whitespace-nowrap">{fieldName}</td>
      {/* Capped so a long store name cannot push the date off the row; the
          full name is on the consignment itself. */}
      <td className="max-w-36 truncate px-2 py-2" title={storeName}>
        {storeName}
      </td>
      <td className="tabular px-2 py-2 whitespace-nowrap text-ink-soft">
        {formatRegisterDate(row.entry.storedOn)}
      </td>
    </tr>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
    >
      <path
        d="M6 9.5l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
