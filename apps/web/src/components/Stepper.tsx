import { useTranslation } from 'react-i18next';

/**
 * Packet counts are entered with a stepper, never a generic keyboard
 * (CLAUDE.md §10). Both buttons clear the 56 px floor comfortably, because
 * this is the control that gets pressed dozens of times in a row while
 * standing in a cold store.
 */
export function Stepper({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  /** Upper bound, e.g. the packets still left in a lot. */
  max?: number;
  /** Names what is being counted, for the button labels. */
  label: string;
}) {
  const { t } = useTranslation();
  const atMax = max !== undefined && value >= max;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`${t('stepper.less')} — ${label}`}
        className="flex size-touch items-center justify-center rounded-2xl border-2 border-line bg-surface text-3xl font-bold text-ink active:bg-brand-tint disabled:opacity-35"
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value === 0 ? '' : String(value)}
        placeholder="0"
        aria-label={label}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^0-9]/g, '');
          const next = digits === '' ? 0 : Number(digits);
          onChange(max === undefined ? next : Math.min(next, max));
        }}
        className="tabular h-touch w-20 rounded-2xl border-2 border-line bg-surface text-center text-2xl font-bold text-ink placeholder:text-ink-soft"
      />

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={atMax}
        aria-label={`${t('stepper.more')} — ${label}`}
        className="flex size-touch items-center justify-center rounded-2xl border-2 border-brand bg-surface text-3xl font-bold text-brand-ink active:bg-brand-tint disabled:opacity-35"
      >
        +
      </button>
    </div>
  );
}
