import type { ReactNode } from 'react';

/**
 * The small, repeated pieces every screen is built from. They exist so that a
 * list row on the khata ledger and one in the stock register are the same
 * object, rather than two similar-looking piles of utility classes.
 */

/** A headline number with its label — the top of most screens. */
export function StatCard({
  label,
  children,
  caption,
  onClick,
}: {
  label: string;
  children: ReactNode;
  caption?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="block text-base font-semibold text-ink-soft">{label}</span>
      <span className="mt-1 block">{children}</span>
      {caption ? <span className="mt-1 block text-sm text-ink-soft">{caption}</span> : null}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className="card-tap px-4 py-4">
      {body}
    </button>
  ) : (
    <div className="card px-4 py-4">{body}</div>
  );
}

/**
 * One line in a list: what it is, when, and how much. Tappable when it leads
 * somewhere — the whole row, never a small link inside it.
 */
export function ListRow({
  title,
  subtitle,
  trailing,
  leading,
  onClick,
  dim = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  onClick?: () => void;
  dim?: boolean;
}) {
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold text-ink">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-sm text-ink-soft">{subtitle}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0 text-right">{trailing}</span> : null}
    </>
  );

  const shape = `flex items-center gap-3 px-4 py-3 ${dim ? 'opacity-65' : ''}`;

  return onClick ? (
    <button type="button" onClick={onClick} className={`card-tap ${shape}`}>
      {body}
    </button>
  ) : (
    <div className={`card ${shape}`}>{body}</div>
  );
}

/**
 * Empty states tell the user what to do next, in one sentence (§10). They never
 * apologise and never leave a blank screen.
 */
export function EmptyState({ title, action }: { title: string; action?: string }) {
  return (
    <div className="card px-5 py-10 text-center">
      <p className="text-xl font-semibold text-ink">{title}</p>
      {action ? <p className="mt-2 text-lg text-ink-soft">{action}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="section-title mb-0">{children}</h2>
      {trailing}
    </div>
  );
}

/** A vertical stack of rows with consistent spacing. */
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

/** A label/value pair, for the detail blocks on a lot or an expense. */
export function DetailRow({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: ReactNode;
  tabular?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-base font-semibold text-ink-soft">{label}</dt>
      <dd className={`text-right text-lg font-semibold text-ink ${tabular ? 'tabular' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
