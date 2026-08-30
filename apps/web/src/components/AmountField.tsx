import { parseAmount } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { MicButton } from './MicButton.js';
import { NumberPad } from './NumberPad.js';

/**
 * The amount is the one field that is always mandatory (CLAUDE.md §8.5), so it
 * gets the largest type on the screen and its own pad.
 */
export function AmountField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
}) {
  const { t } = useTranslation();

  const handleSpoken = (transcript: string) => {
    const spoken = parseAmount(transcript);
    // Say nothing rather than write a wrong number into the mandatory field.
    if (spoken !== null) onChange(String(spoken));
  };

  return (
    <section aria-labelledby="amount-label">
      <div className="flex items-end justify-between gap-3">
        <label id="amount-label" className="label" htmlFor="amount-display">
          {t('expense.amountLabel')}
        </label>
        <MicButton onTranscript={handleSpoken} label={t('expense.amountLabel')} />
      </div>

      <output
        id="amount-display"
        className={`tabular mb-3 flex min-h-[4.5rem] items-center justify-end rounded-2xl border-2 px-4 text-5xl font-bold ${
          error ? 'border-danger bg-danger-tint text-danger' : 'border-rule bg-paper-raised text-rupee'
        }`}
      >
        <span className="mr-1 text-3xl">₹</span>
        {value === '' ? <span className="text-ink-soft">{t('expense.amountPlaceholder')}</span> : value}
      </output>

      {error ? (
        <p className="mb-3 text-base font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <NumberPad value={value} onChange={onChange} />
    </section>
  );
}
