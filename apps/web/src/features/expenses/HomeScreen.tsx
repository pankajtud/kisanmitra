import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupees } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { CameraButton } from '../../components/CameraButton.js';
import { OfflineBar } from '../../components/OfflineBar.js';
import { seasonTotal } from '../../db/expenses.js';
import { useCropCycle } from '../../hooks/useAppData.js';
import type { AppContext } from '../../db/seed.js';

/**
 * Three things, large, nothing else above the fold (CLAUDE.md §10): photograph
 * a receipt, add one without a photo, and see this season.
 *
 * "Add stock" is the third home action in the finished app; it arrives with the
 * stock register at M5. A button that does nothing yet would be worse than its
 * absence, so it is not here.
 */
export function HomeScreen({
  ctx,
  onCapture,
  onManualEntry,
  onSeeAll,
  error,
}: {
  ctx: AppContext;
  onCapture: (file: File) => Promise<void>;
  onManualEntry: () => void;
  onSeeAll: () => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  const cycle = useCropCycle(ctx.cropCycleId);
  const summary = useLiveQuery(() => seasonTotal(ctx.cropCycleId), [ctx.cropCycleId]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <OfflineBar />

      <header className="px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
      </header>

      <main className="flex flex-1 flex-col px-4 pb-6">
        {/* Season total: the thing worth glancing at, so it sits at the top
            where the eye lands, while the actions stay under the thumb. */}
        <button
          type="button"
          onClick={onSeeAll}
          className="card mb-4 w-full px-5 py-5 text-left active:bg-brand-tint"
        >
          <span className="block text-lg font-semibold text-ink-soft">
            {t('home.seasonLabel')}
            {cycle ? <span className="tabular"> · {cycle.label}</span> : null}
          </span>
          <span className="tabular mt-1 block text-5xl font-bold text-rupee">
            {formatRupees(summary?.total ?? 0)}
          </span>
          <span className="mt-2 block text-base font-semibold text-brand-dark">
            {summary ? t('home.entryCount', { count: summary.count }) : ''} · {t('home.seeAll')} →
          </span>
        </button>

        {error ? (
          <p className="mb-4 rounded-2xl bg-danger-tint px-4 py-3 text-base font-semibold text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {/* Primary actions in the bottom third, reachable one-handed (§10). */}
        <div className="mt-auto flex flex-col gap-3">
          <CameraButton
            onPhoto={onCapture}
            onError={() => undefined}
            className="btn-primary min-h-[7rem] w-full flex-col gap-2 text-2xl"
          >
            <CameraIcon />
            {t('home.addExpensePhoto')}
          </CameraButton>

          <button type="button" onClick={onManualEntry} className="btn-secondary w-full text-lg">
            {t('home.addExpenseManual')}
          </button>
        </div>
      </main>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
