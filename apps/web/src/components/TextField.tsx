import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MicButton } from './MicButton.js';

/**
 * Every free-text field carries a microphone (CLAUDE.md §10). Typing on a phone
 * keyboard is the single biggest barrier for our users, so the keyboard is the
 * fallback here, not the main path.
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();

  // Speech appends rather than replaces, so a second attempt adds to the note
  // instead of wiping what is already there.
  const append = (text: string) => onChange(value ? `${value} ${text}` : text);

  const shared = {
    id,
    value,
    placeholder,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    className:
      'min-h-touch w-full rounded-2xl border-2 border-rule bg-paper-raised px-4 py-3 text-lg text-ink placeholder:text-ink-soft',
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <label className="label" htmlFor={id}>
          {label} <span className="font-normal text-ink-soft">({t('common.optional')})</span>
        </label>
      </div>
      <div className="flex items-start gap-2">
        {multiline ? <textarea {...shared} rows={2} /> : <input {...shared} type="text" enterKeyHint="done" />}
        <MicButton onTranscript={append} label={label} />
      </div>
    </section>
  );
}
