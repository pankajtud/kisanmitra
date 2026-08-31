import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomNav, type NavTab } from './BottomNav.js';
import { OfflineBar } from './OfflineBar.js';

/**
 * Every screen has the same frame: a title bar, the task, and — for the four
 * top-level destinations — the navigation.
 *
 * A form or a detail view passes no `tab`, so it presents full-screen with a
 * back arrow and owns the whole display. One task per screen (CLAUDE.md §10).
 */
export function Screen({
  title,
  onBack,
  children,
  action,
  tab,
  onNavigate,
  headerAction,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  /** Pinned above the navigation, in the bottom third where a thumb reaches. */
  action?: ReactNode;
  /** Set on a top-level destination to show the navigation. */
  tab?: NavTab;
  onNavigate?: (tab: NavTab) => void;
  /** A single control in the title bar, e.g. settings. */
  headerAction?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-paper">
      <OfflineBar />

      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-line bg-paper/95 px-2 py-2 backdrop-blur">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="btn-quiet size-touch px-0"
            aria-label={t('common.back')}
          >
            <ArrowLeft />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
        {headerAction}
      </header>

      <main className={`mx-auto max-w-lg pt-4 ${tab ? 'screen-pad' : 'px-4 pb-40'}`}>{children}</main>

      {action ? (
        <div
          className={`fixed inset-x-0 z-10 mx-auto max-w-lg border-t border-line bg-paper/95 px-4 pt-3 backdrop-blur ${
            tab
              ? 'bottom-[calc(4.25rem+env(safe-area-inset-bottom))] pb-3'
              : 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
          }`}
        >
          {action}
        </div>
      ) : null}

      {tab && onNavigate ? <BottomNav active={tab} onNavigate={onNavigate} /> : null}
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
