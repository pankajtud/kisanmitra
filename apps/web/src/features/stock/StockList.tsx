import { useLiveQuery } from 'dexie-react-hooks';
import {
  formatLotBreakdown,
  formatRegisterDate,
  remainingBreakdown,
  type LotBreakdownEntry,
} from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { SyncBadge } from '../../components/SyncBadge.js';
import { listLots, lotPosition } from '../../db/stock.js';
import type { AppContext } from '../../db/seed.js';
import { useFields, useGrades } from '../../hooks/useAppData.js';

/**
 * The stock register. Every lot renders through `formatLotBreakdown`, in the
 * `121(10M+83G+21H)` notation the paper register uses — that format is what
 * makes this screen legible to someone who has kept it by hand (CLAUDE.md §5).
 *
 * What is shown is what is *left*, not what was deposited: potatoes leave in
 * instalments, and the question a farmer opens this screen to answer is how
 * much is still in the store.
 */
export function StockList({
  ctx,
  onOpen,
  onAddLot,
  onBack,
}: {
  ctx: AppContext;
  onOpen: (lotId: string) => void;
  onAddLot: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const grades = useGrades(ctx.householdId);
  const fields = useFields(ctx.householdId);

  const lots = useLiveQuery(async () => {
    const rows = await listLots(ctx.cropCycleId);
    return Promise.all(
      rows.map(async (lot) => ({ lot, position: await lotPosition(lot.id) })),
    );
  }, [ctx.cropCycleId]);

  const fieldName = (id: string | null) => fields.find((f) => f.id === id)?.name ?? null;

  const render = (entries: LotBreakdownEntry[]) => formatLotBreakdown(entries);

  const totalRemaining = (lots ?? []).reduce(
    (sum, row) => sum + row.position.remaining.reduce((n, g) => n + g.remaining, 0),
    0,
  );

  return (
    <Screen
      title={t('stock.title')}
      onBack={onBack}
      action={
        <button type="button" onClick={onAddLot} className="btn-primary w-full text-xl">
          {t('stock.newLot')}
        </button>
      }
    >
      <div className="card mb-4 px-5 py-4">
        <span className="block text-lg font-semibold text-ink-soft">{t('home.stockLabel')}</span>
        <span className="tabular block text-4xl font-bold text-brand-dark">
          {t('home.packetsLeft', { count: totalRemaining })}
        </span>
      </div>

      {lots === undefined ? null : lots.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="text-xl font-semibold">{t('stock.empty')}</p>
          <p className="mt-2 text-lg text-ink-soft">{t('stock.emptyAction')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lots.map(({ lot, position }) => {
            const left = remainingBreakdown(position.remaining, grades);
            const sold = left.every((entry) => entry.packets <= 0);

            return (
              <li key={lot.id}>
                <button
                  type="button"
                  onClick={() => onOpen(lot.id)}
                  className="card w-full px-4 py-3 text-left active:bg-brand-tint"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="tabular text-xl font-bold">{lot.lotNo}</span>
                    <span className="tabular text-sm font-medium text-ink-soft">
                      {formatRegisterDate(lot.storedOn)}
                    </span>
                  </span>

                  {/* The composite format, exactly as the register writes it. */}
                  <span className="tabular mt-1 block text-2xl font-bold text-brand-dark">
                    {sold ? t('stock.allSold') : render(left)}
                  </span>

                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                    {lot.variety ? <span className="tabular">{lot.variety}</span> : null}
                    {fieldName(lot.fieldId) ? <span>· {fieldName(lot.fieldId)}</span> : null}
                    {lot.roomRack ? <span className="tabular">· {lot.roomRack}</span> : null}
                    <SyncBadge state={lot.syncState} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
