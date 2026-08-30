import { useTranslation } from 'react-i18next';
import type { SyncState } from '../db/types.js';

/**
 * The sync state is shown honestly (CLAUDE.md §7): a small per-record
 * indicator, never a spinner implying the user has to wait.
 *
 * Until M2 there is nowhere to sync to, so every record reads "saved on this
 * phone" — which is true, and is the reassurance the user actually wants.
 */
export function SyncBadge({ state }: { state: SyncState }) {
  const { t } = useTranslation();
  if (state !== 'pending') return null;

  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t('sync.localOnly')}
    </span>
  );
}
