import { formatRupees } from '@kisanmitra/shared';

/**
 * Every amount in the app renders through here, so money looks the same
 * everywhere and always carries its direction.
 *
 * `tone` is semantic, not decorative: out is terracotta, in is green, and a
 * mixed ledger is readable without stopping to parse a sign.
 */
export function Money({
  amount,
  tone = 'neutral',
  size = 'md',
  /** Face value, shown small beneath when a split makes it differ. */
  gross,
  className = '',
}: {
  amount: number | string | null | undefined;
  tone?: 'debit' | 'credit' | 'neutral' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  gross?: number | string | null;
  className?: string;
}) {
  const value = typeof amount === 'string' ? Number(amount) : (amount ?? 0);

  // 'auto' takes its colour from the sign — for a balance that can go either way.
  const resolved = tone === 'auto' ? (value < 0 ? 'debit' : 'credit') : tone;

  const colour =
    resolved === 'debit' ? 'text-debit' : resolved === 'credit' ? 'text-credit' : 'text-ink';

  const sizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  } as const;

  const grossNumber = typeof gross === 'string' ? Number(gross) : gross;
  const showsGross =
    grossNumber !== null && grossNumber !== undefined && Math.abs(grossNumber - value) > 0.005;

  return (
    <span className={`inline-block ${className}`}>
      <span className={`tabular block font-bold ${sizes[size]} ${colour}`}>
        {formatRupees(amount)}
      </span>
      {showsGross ? (
        <span className="tabular block text-sm font-medium text-ink-soft">
          {formatRupees(grossNumber)}
        </span>
      ) : null}
    </span>
  );
}
