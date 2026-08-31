import { useTranslation } from 'react-i18next';
import { speechSupported, useSpeech } from '../hooks/useSpeech.js';
import { useOnline } from '../hooks/useOnline.js';

/**
 * The microphone is a first-class control on every free-text and amount field
 * (CLAUDE.md §10), not a secondary affordance.
 *
 * When it cannot work it stays on screen and says why, rather than vanishing —
 * a control that disappears reads as broken.
 */
export function MicButton({
  onTranscript,
  label,
}: {
  onTranscript: (text: string) => void;
  /** Names the field, so the button announces what it fills. */
  label: string;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const supported = speechSupported();
  const { start, stop, listening, state } = useSpeech({ onResult: onTranscript });

  const unavailable = !supported ? t('voice.notSupported') : !online ? t('voice.needsInternet') : null;

  if (unavailable) {
    return (
      <span
        className="flex size-touch shrink-0 items-center justify-center rounded-2xl border-2 border-line text-ink-soft"
        title={unavailable}
        aria-label={unavailable}
      >
        <MicIcon muted />
      </span>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-center">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? t('voice.stop') : `${t('voice.start')} — ${label}`}
        className={
          listening
            ? 'flex size-touch items-center justify-center rounded-2xl bg-danger text-white'
            : 'flex size-touch items-center justify-center rounded-2xl border-2 border-brand bg-surface text-brand-ink active:bg-brand-tint'
        }
      >
        <MicIcon />
      </button>
      {listening ? (
        <span className="mt-1 text-xs font-semibold text-danger" role="status">
          {t('voice.listening')}
        </span>
      ) : null}
      {state === 'error' ? (
        <span className="mt-1 text-xs font-semibold text-danger" role="status">
          {t('voice.failed')}
        </span>
      ) : null}
    </div>
  );
}

function MicIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2.2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {muted ? <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /> : null}
    </svg>
  );
}
