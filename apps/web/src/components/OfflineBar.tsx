import { useTranslation } from 'react-i18next';
import { useOnline } from '../hooks/useOnline.js';

/**
 * Being offline is normal here, not an error — cold stores are thick-walled and
 * rural data is patchy. So this states the fact and reassures, and never
 * apologises or suggests the user do anything (CLAUDE.md §10).
 */
export function OfflineBar() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;

  return (
    <p className="bg-brand-tint px-4 py-2 text-center text-base font-semibold text-brand-ink" role="status">
      {t('app.offline')}
    </p>
  );
}
