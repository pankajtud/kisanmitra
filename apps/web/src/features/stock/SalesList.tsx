import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { Money } from '../../components/Money.js';
import { Screen } from '../../components/Screen.js';
import { EmptyState, Rows, StatCard } from '../../components/ui.js';
import { SyncBadge } from '../../components/SyncBadge.js';
import { listSeasonSales, seasonIncome } from '../../db/stock.js';
import { partnersByKhata, shareOf } from '../../db/shares.js';
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
  const income = useLiveQuery(
    () => seasonIncome(ctx.cropCycleId, ctx.householdId),
    [ctx.cropCycleId, ctx.householdId],
  );
  const partners = useLiveQuery(
    () => partnersByKhata(ctx.householdId),
    [ctx.householdId],
    new Map(),
  );

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
      <div className="mb-4">
        <StatCard
          label={t('sale.myIncome')}
          caption={
            income && income.billed !== income.total
              ? `${t('list.billed')} ${formatRupees(income.billed)} · ${t('list.yoursOnly')}`
              : undefined
          }
        >
          <Money amount={income?.total ?? 0} tone="credit" size="xl" />
        </StatCard>
      </div>

      {sales === undefined ? null : sales.length === 0 ? (
        <EmptyState title={t('sale.empty')} action={t('sale.emptyAction')} />
      ) : (
        <Rows>
          {sales.map((sale) => (
            <li key={sale.id}>
              <button
                type="button"
                onClick={() => onOpen(sale.id, sale.lotId)}
                className="card-tap flex w-full items-center gap-3 px-4 py-3"
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

                <Money
                  amount={shareOf(
                    {
                      khataId: sale.khataId,
                      amount: sale.totalAmount,
                      sharingMode: sale.sharingMode,
                      partnerShare: sale.partnerShare,
                    },
                    partners,
                  )}
                  gross={sale.totalAmount}
                  tone="credit"
                  size="md"
                  className="shrink-0"
                />
              </button>
            </li>
          ))}
        </Rows>
      )}
    </Screen>
  );
}
