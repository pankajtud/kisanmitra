import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees, isOverdue, seasonLabel, today } from '@kisanmitra/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavTab } from '../../components/BottomNav.js';
import { Money } from '../../components/Money.js';
import { Screen } from '../../components/Screen.js';
import { EmptyState, Rows } from '../../components/ui.js';
import { yearBooks } from '../../db/khata.js';
import type { AppContext } from '../../db/seed.js';

/**
 * Khatas gathered into a book per year.
 *
 * Which book a khata falls in is decided by the day it was opened, and nothing
 * else. The farming year turns over in October, so a khata opened in March 2026
 * sits in the 2025-26 book alongside the autumn planting it belongs to.
 *
 * The current book is open; older ones are shut with their year's total on the
 * cover, because that is the number anyone looks back for. Everything stays on
 * one screen — this is a disclosure, not another level of navigation (§10).
 */
export function KhataList({
  ctx,
  onOpen,
  onNew,
  onNavigate,
}: {
  ctx: AppContext;
  onOpen: (khataId: string) => void;
  onNew: () => void;
  onNavigate: (tab: NavTab) => void;
}) {
  const { t } = useTranslation();
  const books = useLiveQuery(() => yearBooks(ctx.householdId), [ctx.householdId]);

  const currentSeason = seasonLabel(today());
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const isOpen = (season: string) => opened[season] ?? season === currentSeason;

  return (
    <Screen
      title={t('khata.all')}
      tab="khatas"
      onNavigate={onNavigate}
      action={
        <button type="button" onClick={onNew} className="btn-primary w-full text-xl">
          {t('khata.new')}
        </button>
      }
    >
      {books === undefined ? null : books.length === 0 ? (
        <EmptyState title={t('khata.empty')} action={t('khata.emptyAction')} />
      ) : (
        <div className="flex flex-col gap-4">
          {books.map((book) => {
            const open = isOpen(book.season);
            return (
              <section key={book.season}>
                {/* The cover: the year, what it came to, and whether anything
                    in it is still running. */}
                <button
                  type="button"
                  onClick={() => setOpened((o) => ({ ...o, [book.season]: !open }))}
                  aria-expanded={open}
                  className="card-tap mb-2 w-full px-4 py-3"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="tabular block text-xl font-bold">
                        {t('khata.yearBook', { season: book.season })}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {t('khata.khataCount', { count: book.khatas.length })} ·{' '}
                        {book.openCount > 0
                          ? t('khata.openCount', { count: book.openCount })
                          : t('khata.allSettled')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Money amount={book.balance} tone="auto" size="md" />
                      <Chevron open={open} />
                    </span>
                  </span>
                </button>

                {open ? (
                  <Rows>
                    {book.khatas.map(({ khata, balance }) => {
                      const settled = khata.status === 'settled';
                      const late =
                        !settled && isOverdue(khata.openedOn, khata.durationMonths, today());

                      return (
                        <li key={khata.id}>
                          <button
                            type="button"
                            onClick={() => onOpen(khata.id)}
                            className={`card-tap w-full px-4 py-4 ${settled ? 'opacity-65' : ''}`}
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 flex-1 truncate text-lg font-bold">
                                {khata.name}
                              </span>
                              <span className={settled ? 'badge-done' : 'badge-open'}>
                                {settled ? t('khata.settled') : t('khata.open')}
                              </span>
                            </span>

                            <Money amount={balance.balance} tone="auto" size="lg" className="mt-1" />

                            <span className="tabular mt-1 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                              <span className="text-debit">
                                {t('khata.expenses')} {formatRupees(balance.expenses)}
                              </span>
                              <span className="text-credit">
                                {t('khata.earnings')} {formatRupees(balance.earnings)}
                              </span>
                              <span>
                                · {t('khata.openedLabel')} {formatRegisterDate(khata.openedOn)}
                              </span>
                              {late ? (
                                <span className="font-semibold text-accent">
                                  · {t('khata.overdue')}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </Rows>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </Screen>
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
