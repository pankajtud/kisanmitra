import { formatRupees, parseAmount, shareForPercent, type SharingMode } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { SuggestField } from './SuggestField.js';

/**
 * How one entry is split.
 *
 * The khata already carries the agreed percentages, so the default costs no
 * taps at all — it just says what will happen. The other two modes exist for
 * the entries that depart from the agreement: one the household paid alone, or
 * one split differently in rupees because that is how the receipt fell.
 */
export function SharingField({
  amount,
  mode,
  onModeChange,
  partnerName,
  partnerShare,
  onPartnerNameChange,
  onPartnerShareChange,
  knownPartners,
  /** The khata's own percentage, used to preview the default split. */
  selfPercent,
  khataName,
  shareLabel,
  errors,
}: {
  amount: number | null;
  mode: SharingMode;
  onModeChange: (mode: SharingMode) => void;
  partnerName: string;
  partnerShare: string;
  onPartnerNameChange: (next: string) => void;
  onPartnerShareChange: (next: string) => void;
  knownPartners: string[];
  selfPercent: number;
  khataName: string | null;
  shareLabel: string;
  errors?: { name?: string; share?: string };
}) {
  const { t } = useTranslation();

  const own =
    amount === null
      ? null
      : mode === 'none'
        ? amount
        : mode === 'custom'
          ? Math.max(0, amount - (parseAmount(partnerShare) ?? 0))
          : Math.round(amount * (selfPercent / 100) * 100) / 100;

  // A khata with no partners has nothing to choose between.
  const shared = selfPercent < 100;

  return (
    <section className="card px-4 py-4">
      <span className="label">{t('sharing.label')}</span>

      <div className="flex flex-wrap gap-2">
        {(['khata', 'none', 'custom'] as const).map((option) => {
          if (option === 'khata' && !shared) return null;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onModeChange(option)}
              aria-pressed={mode === option}
              className={`btn flex-1 px-3 text-base ${
                mode === option
                  ? 'bg-brand text-paper'
                  : 'border-2 border-rule bg-paper-raised text-ink active:bg-brand-tint'
              }`}
            >
              {option === 'khata'
                ? `${t('sharing.khata')} (${selfPercent}%)`
                : t(`sharing.${option}`)}
            </button>
          );
        })}
      </div>

      {mode === 'khata' && shared && khataName ? (
        <p className="mt-2 text-sm text-ink-soft">{khataName}</p>
      ) : null}

      {mode === 'custom' ? (
        <div className="mt-4 flex flex-col gap-4">
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
            <label className="label" htmlFor="sharing-partner-share">
              {t('expense.partnerShareLabel')}
            </label>
            <div className="flex items-start gap-2">
              <div className="relative flex-1">
                <span className="tabular pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-ink-soft">
                  ₹
                </span>
                <input
                  id="sharing-partner-share"
                  type="text"
                  inputMode="decimal"
                  value={partnerShare}
                  placeholder="0"
                  onChange={(event) => onPartnerShareChange(event.target.value.replace(/[^0-9.]/g, ''))}
                  className={`tabular min-h-touch w-full rounded-2xl border-2 bg-paper-raised py-3 pr-4 pl-10 text-2xl font-bold text-rupee ${
                    errors?.share ? 'border-danger' : 'border-rule'
                  }`}
                />
              </div>
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
        </div>
      ) : null}

      {/* What this entry is actually worth to the household. */}
      <dl className="mt-4 flex items-baseline justify-between border-t-2 border-rule pt-3">
        <dt className="text-lg font-semibold text-ink-soft">{shareLabel}</dt>
        <dd className="tabular text-3xl font-bold text-rupee">
          {own === null ? '—' : formatRupees(own)}
        </dd>
      </dl>
    </section>
  );
}
