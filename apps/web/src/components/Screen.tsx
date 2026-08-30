import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * One task per screen (CLAUDE.md §10). A screen is a title, the task, and its
 * primary action pinned to the bottom third where a thumb reaches.
 */
export function Screen({
  title,
  onBack,
  children,
  action,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  /** Pinned above the fold's bottom edge. */
  action?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b-2 border-rule bg-paper px-3 py-2">
        {onBack ? (
          <button type="button" onClick={onBack} className="btn-quiet px-4" aria-label={t('common.back')}>
            <ArrowLeft />
          </button>
        ) : null}
        <h1 className="truncate text-xl font-bold">{title}</h1>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      {action ? (
        <div className="sticky bottom-0 border-t-2 border-rule bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {action}
        </div>
      ) : null}
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
