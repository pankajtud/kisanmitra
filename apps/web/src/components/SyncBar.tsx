import { useTranslation } from 'react-i18next';
import type { SyncStatus } from '../hooks/useSync.js';
import { useOnline } from '../hooks/useOnline.js';

/**
 * What sync is doing, stated plainly.
 *
 * Never a spinner that implies the user must wait (CLAUDE.md §7): the record is
 * already saved on the phone before any of this runs. When there is nothing
 * outstanding it says nothing at all, because a permanent green tick is noise.
 */
export function SyncBar({ status, signedIn }: { status: SyncStatus; signedIn: boolean }) {
  const { t } = useTranslation();
  const online = useOnline();

  if (!signedIn || status.pending === 0) return null;

  return (
    <p
      className="bg-accent-tint px-4 py-1.5 text-center text-sm font-semibold text-ink-soft"
      role="status"
    >
      {t('account.pending', { count: status.pending })}
      {!online ? ` · ${t('account.offlineNote')}` : null}
    </p>
  );
}
