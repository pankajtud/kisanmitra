import { SEED_UNITS } from '@kisanmitra/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * How much was bought or sold — 60 litres of diesel, 12 कुंतल of wheat.
 *
 * The unit is tapped from a short list rather than typed, and the list is
 * seeded rather than fixed: units are configurable reference data, so a
 * household that measures in something else can still type it (CLAUDE.md §1).
 */
export function QuantityField({
  label,
  quantity,
  unit,
  onQuantityChange,
  onUnitChange,
  /** The crop's usual unit, offered first so the common case is already chosen. */
  suggestedUnit,
}: {
  label: string;
  quantity: string;
  unit: string;
  onQuantityChange: (next: string) => void;
  onUnitChange: (next: string) => void;
  suggestedUnit?: string | null;
}) {
  const { t } = useTranslation();
  const id = useId();

  // The crop's own unit leads, then the seeded list, without repeats.
  const units = [...new Set([suggestedUnit, ...SEED_UNITS].filter(Boolean) as string[])];

  return (
    <section>
      <label className="label" htmlFor={id}>
        {label} <span className="font-normal text-ink-soft">({t('common.optional')})</span>
      </label>

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={quantity}
          placeholder="0"
          onChange={(event) => onQuantityChange(event.target.value.replace(/[^0-9.]/g, ''))}
          className="tabular min-h-touch w-28 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-center text-2xl font-bold text-ink placeholder:text-ink-soft"
        />

        <ul className="flex flex-1 flex-wrap gap-2">
          {units.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => onUnitChange(unit === option ? '' : option)}
                aria-pressed={unit === option}
                className={`btn min-h-[2.75rem] px-4 py-1 text-base ${
                  unit === option
                    ? 'bg-brand text-white'
                    : 'border-2 border-line bg-surface text-ink active:bg-brand-tint'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
