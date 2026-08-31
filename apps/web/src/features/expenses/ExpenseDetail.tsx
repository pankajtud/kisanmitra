import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees } from '@kisanmitra/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoPreview } from '../../components/PhotoPreview.js';
import { Screen } from '../../components/Screen.js';
import { SyncBadge } from '../../components/SyncBadge.js';
import { deleteExpense, getExpense } from '../../db/expenses.js';
import type { AppContext } from '../../db/seed.js';
import { useCategories, useFields } from '../../hooks/useAppData.js';
import { useRefLabel } from '../../lib/labels.js';

export function ExpenseDetail({
  ctx,
  expenseId,
  onEdit,
  onDeleted,
  onBack,
}: {
  ctx: AppContext;
  expenseId: string;
  onEdit: () => void;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const refLabel = useRefLabel();
  const categories = useCategories(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const expense = useLiveQuery(() => getExpense(expenseId), [expenseId]);
  const [confirming, setConfirming] = useState(false);

  if (expense === undefined) {
    return (
      <Screen title={t('detail.title')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  if (!expense) {
    return (
      <Screen title={t('detail.title')} onBack={onBack}>
        <p className="text-lg font-semibold text-danger" role="alert">
          {t('error.notFound')}
        </p>
      </Screen>
    );
  }

  const category = categories.find((c) => c.id === expense.categoryId);
  const field = fields.find((f) => f.id === expense.fieldId);

  return (
    <Screen
      title={t('detail.title')}
      onBack={onBack}
      action={
        <button type="button" onClick={onEdit} className="btn-primary w-full text-xl">
          {t('detail.edit')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        {expense.receiptId ? <PhotoPreview receiptId={expense.receiptId} /> : null}

        <p className="tabular text-6xl font-bold text-debit">{formatRupees(expense.amount)}</p>

        <dl className="card divide-y-2 divide-line">
          <Row label={t('expense.dateLabel')} value={formatRegisterDate(expense.spentOn)} tabular />
          <Row
            label={t('expense.categoryLabel')}
            value={category ? refLabel(category) : t('list.noCategory')}
          />
          <Row label={t('expense.fieldLabel')} value={field?.name ?? t('expense.fieldAll')} />
          {expense.vendor ? <Row label={t('expense.vendorLabel')} value={expense.vendor} /> : null}
          {expense.notes ? <Row label={t('expense.notesLabel')} value={expense.notes} /> : null}
        </dl>

        <SyncBadge state={expense.syncState} />

        {/* Soft delete: the row and its photo both stay (§2.2, §2.7). */}
        {confirming ? (
          <div className="card border-danger bg-danger-tint px-4 py-4">
            <p className="mb-3 text-lg font-semibold text-danger">{t('detail.deleteQuestion')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void deleteExpense(expense.id).then(onDeleted)}
                className="btn-danger flex-1"
              >
                {t('detail.deleteConfirm')}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="btn-quiet flex-1">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="btn-quiet self-start">
            {t('detail.delete')}
          </button>
        )}
      </div>
    </Screen>
  );
}

function Row({ label, value, tabular = false }: { label: string; value: string; tabular?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-base font-semibold text-ink-soft">{label}</dt>
      <dd className={`text-right text-lg font-semibold ${tabular ? 'tabular' : ''}`}>{value}</dd>
    </div>
  );
}
