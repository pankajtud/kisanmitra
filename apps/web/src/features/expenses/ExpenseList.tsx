import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees, relativeDayKey } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { CameraButton } from '../../components/CameraButton.js';
import { Screen } from '../../components/Screen.js';
import type { NavTab } from '../../components/BottomNav.js';
import { Money } from '../../components/Money.js';
import { EmptyState, Rows, StatCard } from '../../components/ui.js';
import { SyncBadge } from '../../components/SyncBadge.js';
import { listExpenses, seasonTotal } from '../../db/expenses.js';
import { partnersByKhata, shareOf } from '../../db/shares.js';
import { db } from '../../db/db.js';
import type { LocalExpense } from '../../db/types.js';
import type { AppContext } from '../../db/seed.js';
import { useCategories, useFields } from '../../hooks/useAppData.js';
import { useRefLabel } from '../../lib/labels.js';

/** The season register: what was spent, when, on what. Newest first. */
export function ExpenseList({
  ctx,
  onOpen,
  onCapture,
  onNavigate,
}: {
  ctx: AppContext;
  onOpen: (id: string) => void;
  onCapture: (file: File) => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}) {
  const { t } = useTranslation();
  const refLabel = useRefLabel();
  const categories = useCategories(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const expenses = useLiveQuery(() => listExpenses(ctx.cropCycleId), [ctx.cropCycleId]);
  const cycle = useLiveQuery(() => db.cropCycles.get(ctx.cropCycleId), [ctx.cropCycleId]);

  const categoryName = (id: string | null) => {
    const found = categories.find((c) => c.id === id);
    return found ? refLabel(found) : t('list.noCategory');
  };
  const fieldName = (id: string | null) => fields.find((f) => f.id === id)?.name ?? null;

  // The household's own share, netted of any partner's cut — the same figure
  // the home screen and the khata balances use.
  const summary = useLiveQuery(
    () => seasonTotal(ctx.cropCycleId, ctx.householdId),
    [ctx.cropCycleId, ctx.householdId],
  );
  const partners = useLiveQuery(
    () => partnersByKhata(ctx.householdId),
    [ctx.householdId],
    new Map(),
  );

  return (
    <Screen
      title={`${t('list.title')}${cycle ? ` · ${cycle.label}` : ''}`}
      tab="expenses"
      onNavigate={onNavigate}
      action={
        <CameraButton
          onPhoto={onCapture}
          onError={() => undefined}
          className="btn-primary w-full text-xl"
        >
          {t('home.addExpensePhoto')}
        </CameraButton>
      }
    >
      <div className="mb-4">
        <StatCard
          label={t('list.total')}
          caption={
            summary && summary.billed !== summary.total
              ? `${t('list.billed')} ${formatRupees(summary.billed)} · ${t('list.yoursOnly')}`
              : undefined
          }
        >
          <Money amount={summary?.total ?? 0} tone="debit" size="xl" />
        </StatCard>
      </div>

      {expenses === undefined ? null : expenses.length === 0 ? (
        /* An empty state says what to do next, in one sentence (§10). */
        <EmptyState title={t('list.empty')} action={t('list.emptyAction')} />
      ) : (
        <ol className="flex flex-col gap-3">
          {groupByDay(expenses).map(([day, rows]) => (
            <li key={day}>
              <h2 className="tabular mb-2 text-lg font-bold text-ink-soft">{dayHeading(day, t)}</h2>
              <Rows>
                {rows.map((expense) => (
                  <li key={expense.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(expense.id)}
                      className="card-tap flex min-h-touch w-full items-center gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-semibold">
                          {categoryName(expense.categoryId)}
                          {expense.vendor ? (
                            <span className="font-normal text-ink-soft"> · {expense.vendor}</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                          {fieldName(expense.fieldId) ?? t('expense.fieldAll')}
                          <SyncBadge state={expense.syncState} />
                        </span>
                      </span>
                      <Money
                        amount={shareOf(expense, partners)}
                        gross={expense.amount}
                        tone="debit"
                        size="md"
                        className="shrink-0"
                      />
                    </button>
                  </li>
                ))}
              </Rows>
            </li>
          ))}
        </ol>
      )}
    </Screen>
  );
}

function groupByDay(expenses: LocalExpense[]): [string, LocalExpense[]][] {
  const groups = new Map<string, LocalExpense[]>();
  for (const expense of expenses) {
    const bucket = groups.get(expense.spentOn);
    if (bucket) bucket.push(expense);
    else groups.set(expense.spentOn, [expense]);
  }
  return [...groups.entries()];
}

function dayHeading(day: string, t: (key: string) => string): string {
  const relative = relativeDayKey(day);
  if (relative === 'today') return t('list.today');
  if (relative === 'yesterday') return t('list.yesterday');
  return formatRegisterDate(day);
}
