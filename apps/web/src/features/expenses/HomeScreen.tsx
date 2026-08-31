import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { CameraButton } from '../../components/CameraButton.js';
import { Money } from '../../components/Money.js';
import { Screen } from '../../components/Screen.js';
import type { NavTab } from '../../components/BottomNav.js';
import { StatCard } from '../../components/ui.js';
import { seasonTotal } from '../../db/expenses.js';
import { inventorySummary } from '../../db/inventory.js';
import { seasonIncome } from '../../db/stock.js';
import { useCropCycle } from '../../hooks/useAppData.js';
import type { AppContext } from '../../db/seed.js';

/**
 * The season at a glance, then the things you came to do.
 *
 * Three actions, large, in the bottom third (CLAUDE.md §10): photograph a
 * receipt, add stock, record a sale. The numbers above are all the household's
 * own share — a joint cost or a partnership crop counts only their half.
 */
export function HomeScreen({
  ctx,
  onCapture,
  onManualEntry,
  onSeeExpenses,
  onSeeStock,
  onAddLot,
  onSeeSales,
  onSettings,
  onNavigate,
  error,
}: {
  ctx: AppContext;
  onCapture: (file: File) => Promise<void>;
  onManualEntry: () => void;
  onSeeExpenses: () => void;
  onSeeStock: () => void;
  onAddLot: () => void;
  onSeeSales: () => void;
  onSettings: () => void;
  onNavigate: (tab: NavTab) => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  const cycle = useCropCycle(ctx.cropCycleId);
  const expenses = useLiveQuery(
    () => seasonTotal(ctx.cropCycleId, ctx.householdId),
    [ctx.cropCycleId, ctx.householdId],
  );
  const income = useLiveQuery(
    () => seasonIncome(ctx.cropCycleId, ctx.householdId),
    [ctx.cropCycleId, ctx.householdId],
  );
  const stock = useLiveQuery(() => inventorySummary(ctx.cropCycleId), [ctx.cropCycleId]);

  const net = (income?.total ?? 0) - (expenses?.total ?? 0);

  return (
    <Screen
      title={t('app.name')}
      tab="home"
      onNavigate={onNavigate}
      headerAction={
        <button
          type="button"
          onClick={onSettings}
          aria-label={t('settings.title')}
          className="btn-quiet size-touch px-0"
        >
          <GearIcon />
        </button>
      }
    >
      {/* The season, netted. This is the number the whole app exists to produce. */}
      <section className="card mb-3 px-5 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold text-ink-soft">{t('home.netLabel')}</span>
          <span className="tabular text-sm font-semibold text-ink-soft">{cycle?.label}</span>
        </div>
        <Money amount={net} tone="auto" size="xl" className="mt-1" />

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <button
            type="button"
            onClick={onSeeExpenses}
            aria-label={t('list.title')}
            className="text-left"
          >
            <dt className="text-sm font-semibold text-ink-soft">{t('khata.expenses')}</dt>
            <dd>
              <Money amount={expenses?.total ?? 0} tone="debit" size="md" />
            </dd>
          </button>
          <button
            type="button"
            onClick={onSeeSales}
            aria-label={t('sale.seasonTitle')}
            className="text-right"
          >
            <dt className="text-sm font-semibold text-ink-soft">{t('khata.earnings')}</dt>
            <dd>
              <Money amount={income?.total ?? 0} tone="credit" size="md" />
            </dd>
          </button>
        </dl>
      </section>

      <div className="mb-4">
        <StatCard
          label={t('home.stockLabel')}
          onClick={onSeeStock}
          caption={
            stock && stock.entryCount > 0
              ? `${t('inventory.lotCount', { count: stock.lotCount })}`
              : undefined
          }
        >
          <span className="tabular block text-3xl font-bold text-brand">
            {stock && stock.entryCount > 0
              ? t('home.packetsLeft', { count: stock.remaining })
              : t('home.noStock')}
          </span>
        </StatCard>
      </div>

      {error ? (
        <p className="error-text mb-4 rounded-2xl bg-danger-tint px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}

      {/* Primary actions, reachable one-handed. */}
      <div className="flex flex-col gap-3">
        <CameraButton
          onPhoto={onCapture}
          onError={() => undefined}
          className="btn-primary min-h-[6rem] w-full flex-col gap-1 text-xl"
        >
          <CameraIcon />
          {t('home.addExpensePhoto')}
        </CameraButton>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onAddLot} className="btn-secondary text-lg">
            {t('home.addStock')}
          </button>
          <button type="button" onClick={onSeeSales} className="btn-secondary text-lg">
            {t('home.addSale')}
          </button>
        </div>

        <button type="button" onClick={onManualEntry} className="btn-quiet w-full">
          {t('home.addExpenseManual')}
        </button>
      </div>
    </Screen>
  );
}

function CameraIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8.5A2 2 0 0 1 5 6.5h2l1.2-2h7.6L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
