import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MicButton } from './MicButton.js';

/**
 * Free text with autocomplete over what has been entered before — the
 * treatment CLAUDE.md §5 asks for on `variety`, and the same one that suits a
 * partner or a buyer. A name is typed once and tapped every time after, which
 * is the whole point (§2.4).
 *
 * Suggestions are buttons above the input rather than a native datalist: a
 * datalist dropdown on a cheap Android is a small, fiddly list.
 */
export function SuggestField({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  error,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
  error?: string | null;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [dismissed, setDismissed] = useState(false);

  const matches = suggestions
    .filter((s) => s.toLowerCase() !== value.trim().toLowerCase())
    .filter((s) => (value ? s.toLowerCase().includes(value.trim().toLowerCase()) : true))
    .slice(0, 4);

  return (
    <section>
      <label className="label" htmlFor={id}>
        {label}
        {required ? null : <span className="font-normal text-ink-soft"> ({t('common.optional')})</span>}
      </label>

      <div className="flex items-start gap-2">
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          enterKeyHint="done"
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-touch w-full rounded-2xl border-2 bg-paper-raised px-4 py-3 text-lg text-ink placeholder:text-ink-soft ${
            error ? 'border-danger' : 'border-rule'
          }`}
        />
        <MicButton onTranscript={(text) => onChange(text)} label={label} />
      </div>

      {error ? (
        <p className="mt-2 text-base font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {matches.length > 0 && !dismissed ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {matches.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => {
                  onChange(suggestion);
                  setDismissed(true);
                }}
                className="btn-secondary min-h-[2.75rem] px-4 py-1 text-base"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
