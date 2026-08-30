import { addDays, formatRegisterDate, today } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';

/**
 * Dates show as `27/02/2025`, matching the register, and default to today with
 * one tap to change (CLAUDE.md §10).
 *
 * Yesterday gets its own button because that is the overwhelmingly common
 * correction — receipts get entered the evening after the trip to the market.
 * Anything further back opens the phone's own date picker.
 */
export function DateField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useTranslation();
  const now = today();
  const yesterday = addDays(now, -1);

  return (
    <section aria-labelledby="date-label">
      <span id="date-label" className="label">
        {t('expense.dateLabel')}
      </span>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(now)}
          aria-pressed={value === now}
          className={value === now ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
        >
          {t('list.today')}
        </button>
        <button
          type="button"
          onClick={() => onChange(yesterday)}
          aria-pressed={value === yesterday}
          className={value === yesterday ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
        >
          {t('list.yesterday')}
        </button>

        <label
          className={`btn tabular relative flex-1 basis-full cursor-pointer ${
            value !== now && value !== yesterday
              ? 'bg-brand text-paper'
              : 'border-2 border-brand bg-paper-raised text-brand-dark'
          }`}
        >
          {value !== now && value !== yesterday ? formatRegisterDate(value) : t('date.pick')}
          <input
            type="date"
            value={value}
            max={now}
            onChange={(event) => event.target.value && onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={t('date.pick')}
          />
        </label>
      </div>
    </section>
  );
}
