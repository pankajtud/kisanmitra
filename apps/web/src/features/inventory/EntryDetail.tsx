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
import { db } from '../../db/db.js';
import { deleteEntry, entryLots, entryPosition, getEntry, lotPosition } from '../../db/inventory.js';
import type { AppContext } from '../../db/seed.js';
import { useColdStores, useCrops, useFields, useGrades } from '../../hooks/useAppData.js';

/**
 * One consignment: where it is, which lots it occupies inside that store, and
 * what has been sold out of each. A sale is recorded against a lot, because
 * that is the level at which the cold store and the register track it.
 */
export function EntryDetail({
  ctx,
  entryId,
  onEdit,
  onSellFromLot,
  onOpenSale,
  onDeleted,
  onBack,
}: {
  ctx: AppContext;
  entryId: string;
  onEdit: () => void;
  onSellFromLot: (lotId: string) => void;
  onOpenSale: (saleId: string, lotId: string) => void;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const grades = useGrades(ctx.householdId);
  const crops = useCrops(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const coldStores = useColdStores(ctx.householdId);
  const [confirming, setConfirming] = useState(false);

  const entry = useLiveQuery(() => getEntry(entryId), [entryId]);
  const position = useLiveQuery(() => entryPosition(entryId), [entryId]);
  const lots = useLiveQuery(async () => {
    const rows = await entryLots(entryId);
    return Promise.all(
      rows.map(async (lot) => ({
        lot,
        position: await lotPosition(lot.id),
        sales: await db.sales.where('lotId').equals(lot.id).filter((s) => s.deletedAt === null).toArray(),
      })),
    );
  }, [entryId], []);

  if (entry === undefined || position === undefined) {
    return (
      <Screen title={t('inventory.title')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen title={t('inventory.title')} onBack={onBack}>
        <p className="text-lg font-semibold text-danger" role="alert">
          {t('error.notFound')}
        </p>
      </Screen>
    );
  }

  const store = coldStores.find((c) => c.id === entry.coldStoreId);
  const crop = crops.find((c) => c.id === entry.cropId);
  const field = fields.find((f) => f.id === entry.fieldId);
  const left = remainingBreakdown(position.remaining, grades);
  const soldOut = left.every((e) => e.packets <= 0);

  return (
    <Screen
      title={crop?.nameHi ?? t('inventory.title')}
      onBack={onBack}
      action={
        <button type="button" onClick={onEdit} className="btn-secondary w-full text-lg">
          {t('inventory.edit')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="card px-5 py-4">
          <span className="block text-lg font-semibold text-ink-soft">{t('stock.remaining')}</span>
          <span className="tabular block text-4xl font-bold text-brand-dark">
            {soldOut ? t('stock.allSold') : formatLotBreakdown(left)}
          </span>
          <span className="mt-2 block text-base text-ink-soft">
            {store?.name}
            {entry.variety ? ` · ${entry.variety}` : ''}
            {field ? ` · ${field.name}` : ''}
            {` · ${formatRegisterDate(entry.storedOn)}`}
          </span>
        </div>

        <section>
          <h2 className="mb-2 text-xl font-bold">
            {t('inventory.lots')} · {t('inventory.lotCount', { count: lots.length })}
          </h2>

          <ul className="flex flex-col gap-3">
            {lots.map(({ lot, position: lotPos, sales }) => {
              const lotLeft = remainingBreakdown(lotPos.remaining, grades);
              const lotEmpty = lotLeft.every((e) => e.packets <= 0);
              const revenue = sales.reduce((sum, sale) => sum + (sale.totalAmount ?? 0), 0);

              return (
                <li key={lot.id} className="card px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="tabular text-xl font-bold">{lot.lotNo}</span>
                    {lot.roomRack ? (
                      <span className="tabular text-sm text-ink-soft">{lot.roomRack}</span>
                    ) : null}
                  </div>

                  <span className="tabular mt-1 block text-2xl font-bold text-brand-dark">
                    {lotEmpty ? t('stock.allSold') : formatLotBreakdown(lotLeft)}
                  </span>

                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {lotPos.remaining
                      .filter((row) => row.stored > 0)
                      .map((row) => {
                        const grade = grades.find((g) => g.id === row.gradeId);
                        if (!grade) return null;
                        return (
                          <li key={row.gradeId} className="flex items-center gap-1.5">
                            <GradeMark grade={grade} size={28} />
                            <span className="text-base font-semibold">{grade.labelHi}</span>
                            <span
                              className={`tabular text-base font-bold ${
                                row.remaining < 0 ? 'text-danger' : 'text-ink-soft'
                              }`}
                            >
                              {row.remaining}/{row.stored}
                            </span>
                          </li>
                        );
                      })}
                  </ul>

                  {sales.length > 0 ? (
                    <ul className="mt-3 divide-y-2 divide-rule border-t-2 border-rule">
                      {sales.map((sale) => (
                        <li key={sale.id}>
                          <button
                            type="button"
                            onClick={() => onOpenSale(sale.id, lot.id)}
                            className="tabular flex w-full items-baseline justify-between gap-2 py-2 text-left"
                          >
                            <span className="text-sm text-ink-soft">
                              {formatRegisterDate(sale.soldOn)}
                              {sale.buyer ? ` · ${sale.buyer}` : ''}
                            </span>
                            <span className="font-bold text-rupee">
                              {formatRupees(sale.totalAmount)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSellFromLot(lot.id)}
                      disabled={lotEmpty}
                      className="btn-primary flex-1 text-base disabled:opacity-40"
                    >
                      {lotEmpty ? t('stock.allSold') : t('sale.newSale')}
                    </button>
                    {revenue > 0 ? (
                      <span className="tabular text-lg font-bold text-rupee">
                        {formatRupees(revenue)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {confirming ? (
          <div className="card border-danger bg-danger-tint px-4 py-4">
            <p className="mb-3 text-lg font-semibold text-danger">{t('stock.deleteQuestion')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void deleteEntry(entry.id).then(onDeleted)}
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
