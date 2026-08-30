import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees, householdShare, isShared } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { SyncBadge } from '../../components/SyncBadge.js';
import { listSeasonSales, seasonIncome } from '../../db/stock.js';
import type { AppContext } from '../../db/seed.js';
import { useCrops } from '../../hooks/useAppData.js';
import { useRefLabel } from '../../lib/labels.js';

/**
 * Every sale in the season — out of cold storage or straight off the field.
 *
 * The headline is the household's own income: a crop farmed in partnership
 * splits the money, and only their half is theirs. The billed figure sits
 * underneath so the two are never confused.
 */
export function SalesList({
  ctx,
  onOpen,
  onAddSale,
  onBack,
}: {
  ctx: AppContext;
  onOpen: (saleId: string, lotId: string | null) => void;
  onAddSale: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const refLabel = useRefLabel();
  const crops = useCrops(ctx.householdId);
  const sales = useLiveQuery(() => listSeasonSales(ctx.cropCycleId), [ctx.cropCycleId]);
  const income = useLiveQuery(() => seasonIncome(ctx.cropCycleId), [ctx.cropCycleId]);

  const cropName = (id: string | null) => {
    const crop = crops.find((c) => c.id === id);
    return crop ? refLabel({ labelHi: crop.nameHi, labelEn: crop.nameEn }) : null;
  };

  return (
    <Screen
      title={t('sale.seasonTitle')}
      onBack={onBack}
      action={
        <button type="button" onClick={onAddSale} className="btn-primary w-full text-xl">
          {t('sale.newSale')}
        </button>
      }
    >
      <div className="card mb-4 px-5 py-4">
        <span className="block text-lg font-semibold text-ink-soft">{t('sale.myIncome')}</span>
        <span className="tabular block text-4xl font-bold text-rupee">
          {formatRupees(income?.total ?? 0)}
        </span>
        {income && income.billed !== income.total ? (
          <span className="tabular mt-1 block text-base text-ink-soft">
            {t('list.billed')}: {formatRupees(income.billed)} · {t('list.yoursOnly')}
          </span>
        ) : null}
      </div>

      {sales === undefined ? null : sales.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="text-xl font-semibold">{t('sale.empty')}</p>
          <p className="mt-2 text-lg text-ink-soft">{t('sale.emptyAction')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sales.map((sale) => (
            <li key={sale.id}>
              <button
                type="button"
                onClick={() => onOpen(sale.id, sale.lotId)}
                className="card flex w-full items-center gap-3 px-4 py-3 text-left active:bg-brand-tint"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">
                    {cropName(sale.cropId) ?? t('sale.title')}
                    {sale.quantity !== null ? (
                      <span className="tabular font-normal text-ink-soft">
                        {' '}
                        · {sale.quantity} {sale.unit ?? ''}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                    {formatRegisterDate(sale.soldOn)}
                    {sale.buyer ? <span>· {sale.buyer}</span> : null}
                    {sale.lotId ? <span>· {t('sale.fromStorage')}</span> : null}
                    <SyncBadge state={sale.syncState} />
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="tabular block text-2xl font-bold text-rupee">
                    {formatRupees(
                      householdShare({ amount: sale.totalAmount, partnerShare: sale.partnerShare }),
                    )}
                  </span>
                  {isShared({ amount: sale.totalAmount, partnerShare: sale.partnerShare }) ? (
                    <span className="tabular block text-xs text-ink-soft">
                      {formatRupees(sale.totalAmount)} {t('expense.shared')}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
