import { formatRupees, parseAmount, shareForPercent } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { SuggestField } from './SuggestField.js';

/**
 * Cost sharing. Joint costs — a hired tractor, a pump, a truck — are paid by
 * one household and split with a partner, and only their own portion is their
 * cost. Everything downstream (the season total, and the cost-per-packet at
 * M7) reads `amount - partnerShare`, so this is the control that decides
 * whether that headline number is true.
 *
 * Off by default and collapsed to one tap, because most expenses are not
 * shared and the common case must not get slower.
 */
export function PartnerShareField({
  amount,
  shared,
  onSharedChange,
  partnerName,
  partnerShare,
  onPartnerNameChange,
  onPartnerShareChange,
  onClear,
  knownPartners,
  errors,
  shareLabel,
  promptLabel,
}: {
  /** The full billed amount, as currently typed. */
  amount: number | null;
  /**
   * Whether the user has said this is shared. Explicit rather than inferred
   * from the name being non-empty: tapping "shared" and filling nothing must
   * still be a validation error, not a silent save as unshared.
   */
  shared: boolean;
  onSharedChange: (shared: boolean) => void;
  partnerName: string;
  /** Digits as typed, so a half-finished number is not thrown away. */
  partnerShare: string;
  onPartnerNameChange: (next: string) => void;
  onPartnerShareChange: (next: string) => void;
  onClear: () => void;
  knownPartners: string[];
  errors?: { name?: string; share?: string };
  /** "Your cost" on an expense, "your income" on a sale. */
  shareLabel?: string;
  /** "Was this cost shared?" / "Is the income shared?" */
  promptLabel?: string;
}) {
  const { t } = useTranslation();

  const theirs = parseAmount(partnerShare) ?? 0;
  const mine = amount === null ? null : Math.max(0, amount - theirs);

  if (!shared) {
    return (
      <section>
        <span className="label">{promptLabel ?? t('expense.sharedLabel')}</span>
        <div className="flex gap-2">
          <span className="btn-primary flex-1 cursor-default" aria-current="true">
            {t('expense.notShared')}
          </span>
          <button type="button" onClick={() => onSharedChange(true)} className="btn-secondary flex-1">
            {t('expense.shared')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card border-brand/40 bg-brand-tint/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-lg font-bold">{t('expense.shared')}</span>
        <button type="button" onClick={onClear} className="btn-quiet min-h-[2.75rem] px-4 text-base">
          {t('expense.notShared')}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <SuggestField
          label={t('expense.partnerNameLabel')}
          value={partnerName}
          onChange={onPartnerNameChange}
          suggestions={knownPartners}
          placeholder={t('expense.partnerNamePlaceholder')}
          error={errors?.name}
          required
        />

        <div>
          <label className="label" htmlFor="partner-share">
            {t('expense.partnerShareLabel')}
          </label>
          <div className="flex items-start gap-2">
            <div className="relative flex-1">
              <span className="tabular pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-ink-soft">
                ₹
              </span>
              <input
                id="partner-share"
                type="text"
                inputMode="decimal"
                value={partnerShare}
                placeholder="0"
                onChange={(event) =>
                  onPartnerShareChange(event.target.value.replace(/[^0-9.]/g, ''))
                }
                className={`tabular min-h-touch w-full rounded-2xl border-2 bg-paper-raised py-3 pr-4 pl-10 text-2xl font-bold text-rupee placeholder:text-ink-soft ${
                  errors?.share ? 'border-danger' : 'border-rule'
                }`}
              />
            </div>
            {/* An even split is overwhelmingly the common case, so it is one tap
                rather than mental arithmetic on a phone. */}
            <button
              type="button"
              disabled={amount === null || amount <= 0}
              onClick={() => onPartnerShareChange(String(shareForPercent(amount ?? 0, 50)))}
              className="btn-secondary px-4 text-base disabled:opacity-40"
            >
              {t('expense.half')}
            </button>
          </div>

          {errors?.share ? (
            <p className="mt-2 text-base font-semibold text-danger" role="alert">
              {errors.share}
            </p>
          ) : null}
        </div>

        {/* What this actually costs the household — the number that ends up in
            the season total. Shown here so the split is never a surprise. */}
        <dl className="flex items-baseline justify-between border-t-2 border-rule pt-3">
          <dt className="text-lg font-semibold text-ink-soft">{shareLabel ?? t('expense.myShare')}</dt>
          <dd className="tabular text-3xl font-bold text-rupee">
            {mine === null ? '—' : formatRupees(mine)}
          </dd>
        </dl>
      </div>
    </section>
  );
}
