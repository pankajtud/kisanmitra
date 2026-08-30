import { useLiveQuery } from 'dexie-react-hooks';
import {
  formatLotBreakdown,
  formatRegisterDate,
  formatRupees,
  remainingBreakdown,
} from '@kisanmitra/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradeMark } from '../../components/GradeMark.js';
import { Screen } from '../../components/Screen.js';
import { deleteLot, getLot, listSales, lotPosition } from '../../db/stock.js';
import { db } from '../../db/db.js';
import type { AppContext } from '../../db/seed.js';
import { useFields, useGrades } from '../../hooks/useAppData.js';

/**
 * One lot: what went in, what has been sold out of it in instalments, and what
 * is still in the store.
 */
export function LotDetail({
  ctx,
  lotId,
  onEdit,
  onAddSale,
  onOpenSale,
  onDeleted,
  onBack,
}: {
  ctx: AppContext;
  lotId: string;
  onEdit: () => void;
  onAddSale: () => void;
  onOpenSale: (saleId: string) => void;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const grades = useGrades(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const [confirming, setConfirming] = useState(false);

  const lot = useLiveQuery(() => getLot(lotId), [lotId]);
  const position = useLiveQuery(() => lotPosition(lotId), [lotId]);
  const sales = useLiveQuery(() => listSales(lotId), [lotId], []);
  const saleLines = useLiveQuery(
    async () =>
      sales.length === 0
        ? []
        : db.saleGrades.where('saleId').anyOf(sales.map((s) => s.id)).toArray(),
    [sales],
    [],
  );

  if (lot === undefined || position === undefined) {
    return (
      <Screen title={t('stock.title')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  if (!lot) {
    return (
      <Screen title={t('stock.title')} onBack={onBack}>
        <p className="text-lg font-semibold text-danger" role="alert">
          {t('error.notFound')}
        </p>
      </Screen>
    );
  }

  const gradeById = (id: string) => grades.find((g) => g.id === id);
  const stored = remainingBreakdown(
    position.remaining.map((r) => ({ ...r, remaining: r.stored })),
    grades,
  );
  const left = remainingBreakdown(position.remaining, grades);
  const soldOut = left.every((entry) => entry.packets <= 0);
  const revenue = sales.reduce((sum, sale) => sum + (sale.totalAmount ?? 0), 0);
  const field = fields.find((f) => f.id === lot.fieldId);

  return (
    <Screen
      title={lot.lotNo}
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={onAddSale}
          disabled={soldOut}
          className="btn-primary w-full text-xl disabled:opacity-40"
        >
          {soldOut ? t('stock.allSold') : t('sale.newSale')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        {/* What is left, in the register's own notation — the number the user
            came here for. */}
        <div className="card px-5 py-4">
          <span className="block text-lg font-semibold text-ink-soft">{t('stock.remaining')}</span>
          <span className="tabular block text-4xl font-bold text-brand-dark">
            {soldOut ? t('stock.allSold') : formatLotBreakdown(left)}
          </span>
          <span className="tabular mt-2 block text-base text-ink-soft">
            {t('stock.stored')}: {formatLotBreakdown(stored)}
          </span>
        </div>

        <dl className="card divide-y-2 divide-rule">
          <Row label={t('stock.storedOnLabel')} value={formatRegisterDate(lot.storedOn)} tabular />
          {lot.variety ? <Row label={t('stock.varietyLabel')} value={lot.variety} tabular /> : null}
          <Row label={t('expense.fieldLabel')} value={field?.name ?? t('expense.fieldAll')} />
          {lot.roomRack ? <Row label={t('stock.roomRackLabel')} value={lot.roomRack} tabular /> : null}
        </dl>

        {/* Per-grade position, with the picture and Hindi word (§5). */}
        <ul className="flex flex-col gap-2">
          {position.remaining.map((row) => {
            const grade = gradeById(row.gradeId);
            if (!grade) return null;
            return (
              <li key={row.gradeId} className="card flex items-center gap-3 px-3 py-2">
                <GradeMark grade={grade} size={44} />
                <span className="flex-1 text-lg font-bold">{grade.labelHi}</span>
                <span className="tabular text-right text-sm text-ink-soft">
                  {t('stock.stored')} {row.stored} · {t('stock.sold')} {row.sold}
                </span>
                <span
                  className={`tabular w-12 text-right text-2xl font-bold ${
                    row.remaining < 0 ? 'text-danger' : 'text-brand-dark'
                  }`}
                >
                  {row.remaining}
                </span>
              </li>
            );
          })}
        </ul>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">{t('sale.count', { count: sales.length })}</h2>
            {revenue > 0 ? (
              <span className="tabular text-xl font-bold text-rupee">{formatRupees(revenue)}</span>
            ) : null}
          </div>

          {sales.length === 0 ? (
            <p className="card px-4 py-4 text-center text-lg text-ink-soft">{t('sale.none')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sales.map((sale) => {
                const lines = saleLines.filter((line) => line.saleId === sale.id);
                const breakdown = lines
                  .map((line) => {
                    const grade = gradeById(line.gradeId);
                    return grade
                      ? { code: grade.code, packets: line.packets, sortOrder: grade.sortOrder }
                      : null;
                  })
                  .filter((entry) => entry !== null);

                return (
                  <li key={sale.id}>
                    <button
                      type="button"
                      onClick={() => onOpenSale(sale.id)}
                      className="card flex w-full items-center gap-3 px-4 py-3 text-left active:bg-brand-tint"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="tabular block text-lg font-bold">
                          {formatLotBreakdown(breakdown)}
                        </span>
                        <span className="tabular block text-sm text-ink-soft">
                          {formatRegisterDate(sale.soldOn)}
                          {sale.buyer ? ` · ${sale.buyer}` : ''}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-xl font-bold text-rupee">
                        {formatRupees(sale.totalAmount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className="btn-secondary flex-1">
            {t('detail.edit')}
          </button>
        </div>

        {confirming ? (
          <div className="card border-danger bg-danger-tint px-4 py-4">
            <p className="mb-2 text-lg font-semibold text-danger">{t('stock.deleteQuestion')}</p>
            {/* Removing a lot with sales against it hides those too, so say so. */}
            {sales.length > 0 ? (
              <p className="mb-3 text-base text-danger">
                {t('stock.hasSales', { count: sales.length })}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void deleteLot(lot.id).then(onDeleted)}
                className="btn-danger flex-1"
              >
                {t('stock.deleteConfirm')}
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
