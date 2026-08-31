import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The four places the app goes, always one tap away.
 *
 * CLAUDE.md §10 forbids tabs *within a task* and hamburger menus that hide
 * primary actions. This is neither: it is the top level, always visible, in the
 * bottom third where a thumb reaches — and it is the navigation model our users
 * already know from WhatsApp and YouTube.
 *
 * Forms and detail screens present without it, so a task in progress still owns
 * the whole screen.
 */
export type NavTab = 'home' | 'khatas' | 'inventory' | 'expenses';

export function BottomNav({
  active,
  onNavigate,
}: {
  active: NavTab;
  onNavigate: (tab: NavTab) => void;
}) {
  const { t } = useTranslation();

  const tabs: { id: NavTab; label: string; icon: (active: boolean) => ReactElement }[] = [
    { id: 'home', label: t('nav.home'), icon: HomeIcon },
    { id: 'khatas', label: t('nav.khatas'), icon: BookIcon },
    { id: 'inventory', label: t('nav.stock'), icon: SackIcon },
    { id: 'expenses', label: t('nav.expenses'), icon: ReceiptIcon },
  ];

  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onNavigate(tab.id)}
                aria-current={selected ? 'page' : undefined}
                className={`flex min-h-touch w-full flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  selected ? 'text-brand' : 'text-ink-soft'
                }`}
              >
                {tab.icon(selected)}
                <span className="text-xs font-semibold">{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Icons are drawn rather than imported: five small paths beat a font or an icon
   package against the 200 KB budget (§2.5). Filled when active, outlined when not. */

const stroke = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function HomeIcon(active: boolean) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
        {...stroke}
      />
    </svg>
  );
}

function BookIcon(active: boolean) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z"
        stroke="currentColor"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
        {...stroke}
      />
      <path d="M8 8h7M8 12h7" stroke="currentColor" {...stroke} />
    </svg>
  );
}

function SackIcon(active: boolean) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3h6l-1.5 3.5h-3L9 3Zm1.5 3.5C7.5 8 5 11.5 5 15.5A5.5 5.5 0 0 0 10.5 21h3a5.5 5.5 0 0 0 5.5-5.5c0-4-2.5-7.5-5.5-9h-3Z"
        stroke="currentColor"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
        {...stroke}
      />
    </svg>
  );
}

function ReceiptIcon(active: boolean) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21V3Z"
        stroke="currentColor"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
        {...stroke}
      />
      <path d="M9 8h6M9 12h6" stroke="currentColor" {...stroke} />
    </svg>
  );
}
