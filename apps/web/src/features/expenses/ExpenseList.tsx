import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees, relativeDayKey } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { CameraButton } from '../../components/CameraButton.js';
import { Screen } from '../../components/Screen.js';
import { SyncBadge } from '../../components/SyncBadge.js';
import { listExpenses } from '../../db/expenses.js';
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
  onBack,
}: {
  ctx: AppContext;
  onOpen: (id: string) => void;
  onCapture: (file: File) => Promise<void>;
  onBack: () => void;
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

  const total = (expenses ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0);

  return (
    <Screen
      title={`${t('list.title')}${cycle ? ` · ${cycle.label}` : ''}`}
      onBack={onBack}
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
      <div className="card mb-4 px-5 py-4">
        <span className="block text-lg font-semibold text-ink-soft">{t('list.total')}</span>
        <span className="tabular block text-4xl font-bold text-rupee">{formatRupees(total)}</span>
      </div>

      {expenses === undefined ? null : expenses.length === 0 ? (
        /* An empty state says what to do next, in one sentence (§10). */
        <div className="card px-5 py-8 text-center">
          <p className="text-xl font-semibold">{t('list.empty')}</p>
          <p className="mt-2 text-lg text-ink-soft">{t('list.emptyAction')}</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {groupByDay(expenses).map(([day, rows]) => (
            <li key={day}>
              <h2 className="tabular mb-2 text-lg font-bold text-ink-soft">{dayHeading(day, t)}</h2>
              <ul className="flex flex-col gap-2">
                {rows.map((expense) => (
                  <li key={expense.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(expense.id)}
                      className="card flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left active:bg-brand-tint"
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
                      <span className="tabular shrink-0 text-2xl font-bold text-rupee">
                        {formatRupees(expense.amount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
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
