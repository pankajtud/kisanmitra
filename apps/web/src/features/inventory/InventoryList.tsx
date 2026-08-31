import { useLiveQuery } from 'dexie-react-hooks';
import { formatLotBreakdown, formatRegisterDate, remainingBreakdown } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { SyncBadge } from '../../components/SyncBadge.js';
import { entryPosition, listEntries } from '../../db/inventory.js';
import type { AppContext } from '../../db/seed.js';
import { useColdStores, useCrops, useFields, useGrades } from '../../hooks/useAppData.js';

/**
 * What is in storage, and where.
 *
 * Each row is one consignment in one cold store, showing what is *left* rather
 * than what went in — potatoes leave in instalments, and the question this
 * screen answers is how much is still there. The composite notation is the
 * register's own, through the single `formatLotBreakdown` helper (§5).
 */
export function InventoryList({
  ctx,
  onOpen,
  onNew,
  onBack,
}: {
  ctx: AppContext;
  onOpen: (entryId: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const grades = useGrades(ctx.householdId);
  const crops = useCrops(ctx.householdId);
  const fields = useFields(ctx.householdId);
  const coldStores = useColdStores(ctx.householdId);

  const entries = useLiveQuery(async () => {
    const rows = await listEntries(ctx.cropCycleId);
    return Promise.all(rows.map(async (entry) => ({ entry, position: await entryPosition(entry.id) })));
  }, [ctx.cropCycleId]);

  const totalRemaining = (entries ?? []).reduce(
    (sum, row) => sum + row.position.remaining.reduce((n, g) => n + g.remaining, 0),
    0,
  );

  return (
    <Screen
      title={t('inventory.title')}
      onBack={onBack}
      action={
        <button type="button" onClick={onNew} className="btn-primary w-full text-xl">
          {t('inventory.new')}
        </button>
      }
    >
      <div className="card mb-4 px-5 py-4">
        <span className="block text-lg font-semibold text-ink-soft">{t('home.stockLabel')}</span>
        <span className="tabular block text-4xl font-bold text-brand-dark">
          {t('home.packetsLeft', { count: totalRemaining })}
        </span>
      </div>

      {entries === undefined ? null : entries.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="text-xl font-semibold">{t('inventory.empty')}</p>
          <p className="mt-2 text-lg text-ink-soft">{t('inventory.emptyAction')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(({ entry, position }) => {
            const left = remainingBreakdown(position.remaining, grades);
            const soldOut = left.every((e) => e.packets <= 0);
            const store = coldStores.find((c) => c.id === entry.coldStoreId);
            const crop = crops.find((c) => c.id === entry.cropId);
            const field = fields.find((f) => f.id === entry.fieldId);

            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onOpen(entry.id)}
                  className="card w-full px-4 py-3 text-left active:bg-brand-tint"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xl font-bold">
                      {crop?.nameHi ?? t('inventory.title')}
                    </span>
                    <span className="tabular shrink-0 text-sm font-medium text-ink-soft">
                      {formatRegisterDate(entry.storedOn)}
                    </span>
                  </span>

                  <span className="tabular mt-1 block text-2xl font-bold text-brand-dark">
                    {soldOut ? t('stock.allSold') : formatLotBreakdown(left)}
                  </span>

                  {/* One entry, one cold store — the invariant, stated on screen. */}
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                    {store ? <span>{store.name}</span> : null}
                    <span className="tabular">
                      · {t('inventory.lotCount', { count: position.lots.length })}
                    </span>
                    {entry.variety ? <span className="tabular">· {entry.variety}</span> : null}
                    {field ? <span>· {field.name}</span> : null}
                    <SyncBadge state={entry.syncState} />
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
