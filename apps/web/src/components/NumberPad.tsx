import { useTranslation } from 'react-i18next';

/**
 * Amounts are entered on our own number pad, never a generic phone keyboard
 * (CLAUDE.md §10). Keys are well over the 56 px floor and the layout is the
 * one on a calculator, which our users already know.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'] as const;

export function NumberPad({
  value,
  onChange,
}: {
  /** Digits as typed, e.g. `'4500'`. */
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();

  const press = (key: string) => {
    if (key === '.' && value.includes('.')) return;
    if (key === '.' && value === '') return onChange('0.');
    // Stop at paise: nobody records a receipt to three decimals.
    if (value.includes('.') && value.split('.')[1]!.length >= 2) return;
    if (value === '0' && key !== '.') return onChange(key);
    if (value.length >= 12) return;
    onChange(value + key);
  };

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('expense.amountLabel')}>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className="tabular h-16 rounded-2xl border-2 border-rule bg-paper-raised text-3xl font-bold active:bg-brand-tint"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(value.slice(0, -1))}
        onDoubleClick={() => onChange('')}
        aria-label={t('numpad.backspace')}
        className="flex h-16 items-center justify-center rounded-2xl border-2 border-rule bg-paper-raised active:bg-brand-tint"
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5h11v14H9L3 12l6-7z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M12 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
