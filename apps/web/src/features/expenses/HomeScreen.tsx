import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupees } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { CameraButton } from '../../components/CameraButton.js';
import { OfflineBar } from '../../components/OfflineBar.js';
import { seasonTotal } from '../../db/expenses.js';
import { seasonIncome, stockSummary } from '../../db/stock.js';
import { useCropCycle } from '../../hooks/useAppData.js';
import type { AppContext } from '../../db/seed.js';

/**
 * Three things, large, nothing else above the fold (CLAUDE.md §10): add an
 * expense, add stock, and see this season.
 *
 * The season figures sit at the top where the eye lands; the actions live in
 * the bottom third under the thumb. Money shown is always the household's own
 * share — a cost or an income split with a partner counts only their half.
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
  error: string | null;
}) {
  const { t } = useTranslation();
  const cycle = useCropCycle(ctx.cropCycleId);
  const expenses = useLiveQuery(() => seasonTotal(ctx.cropCycleId), [ctx.cropCycleId]);
  const income = useLiveQuery(() => seasonIncome(ctx.cropCycleId), [ctx.cropCycleId]);
  const stock = useLiveQuery(() => stockSummary(ctx.cropCycleId), [ctx.cropCycleId]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <OfflineBar />

      <header className="flex items-center justify-between gap-2 px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <button
          type="button"
          onClick={onSettings}
          aria-label={t('settings.title')}
          className="btn-quiet size-touch px-0"
        >
          <GearIcon />
        </button>
      </header>

      <main className="flex flex-1 flex-col px-4 pb-6">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <SummaryCard
            label={t('home.seasonLabel')}
            value={formatRupees(expenses?.total ?? 0)}
            caption={cycle?.label}
            onClick={onSeeExpenses}
            tone="rupee"
          />
          <SummaryCard
            label={t('home.incomeLabel')}
            value={formatRupees(income?.total ?? 0)}
            caption={income ? t('sale.count', { count: income.count }) : undefined}
            onClick={onSeeSales}
            tone="brand"
          />
        </div>

        <button
          type="button"
          onClick={onSeeStock}
          className="card mb-4 w-full px-5 py-4 text-left active:bg-brand-tint"
        >
          <span className="block text-lg font-semibold text-ink-soft">{t('home.stockLabel')}</span>
          <span className="tabular mt-1 block text-3xl font-bold text-brand-dark">
            {stock && stock.lotCount > 0
              ? t('home.packetsLeft', { count: stock.remaining })
              : t('home.noStock')}
          </span>
        </button>

        {error ? (
          <p
            className="mb-4 rounded-2xl bg-danger-tint px-4 py-3 text-base font-semibold text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {/* Primary actions, bottom third, reachable one-handed (§10). */}
        <div className="mt-auto flex flex-col gap-3">
          <CameraButton
            onPhoto={onCapture}
            onError={() => undefined}
            className="btn-primary min-h-[6.5rem] w-full flex-col gap-2 text-2xl"
          >
            <CameraIcon />
            {t('home.addExpensePhoto')}
          </CameraButton>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onAddLot} className="btn-secondary text-lg">
              {t('home.addStock')}
            </button>
            <button type="button" onClick={onSeeSales} className="btn-secondary text-lg">
              {t('home.addSale')}
            </button>
          </div>

          <button type="button" onClick={onManualEntry} className="btn-quiet w-full text-base">
            {t('home.addExpenseManual')}
          </button>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  onClick,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  onClick: () => void;
  tone: 'rupee' | 'brand';
}) {
  return (
    <button type="button" onClick={onClick} className="card px-4 py-4 text-left active:bg-brand-tint">
      <span className="block text-base font-semibold text-ink-soft">{label}</span>
      <span
        className={`tabular mt-1 block text-3xl leading-tight font-bold ${
          tone === 'rupee' ? 'text-rupee' : 'text-brand-dark'
        }`}
      >
        {value}
      </span>
      {caption ? <span className="tabular mt-1 block text-sm text-ink-soft">{caption}</span> : null}
    </button>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
