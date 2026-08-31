import type { ReactNode } from 'react';

export interface Choice {
  id: string;
  /** Already in the user's language — category and field names are reference data, not i18n keys. */
  label: string;
  icon?: ReactNode;
}

/**
 * Tap, don't type (CLAUDE.md §2.4). Categories and fields are always a grid of
 * large buttons rather than a select, because a native select on a cheap
 * Android is a small scrolling list.
 */
export function ChoiceGrid({
  legend,
  choices,
  value,
  onChange,
  emptyChoiceLabel,
  error,
}: {
  legend: string;
  choices: Choice[];
  value: string | null;
  onChange: (next: string | null) => void;
  /** Renders a leading "none of these" option, e.g. "whole farm". */
  emptyChoiceLabel?: string;
  error?: string | null;
}) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>

      {error ? (
        <p className="mb-2 error-text" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {emptyChoiceLabel ? (
          <Option selected={value === null} onClick={() => onChange(null)} label={emptyChoiceLabel} />
        ) : null}

        {choices.map((choice) => (
          <Option
            key={choice.id}
            selected={value === choice.id}
            onClick={() => onChange(choice.id)}
            label={choice.label}
            icon={choice.icon}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Option({
  selected,
  onClick,
  label,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-touch items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left text-base font-semibold leading-tight ${
        selected
          ? 'border-brand bg-brand text-white'
          : 'border-line bg-surface text-ink active:bg-brand-tint'
      }`}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}
