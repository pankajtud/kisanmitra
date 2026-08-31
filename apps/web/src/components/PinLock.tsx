import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTO_LOCK_MINUTES, isLockSet, setPin, unlock } from '../db/lock.js';

const PIN_LENGTH = 4;

/**
 * The gate in front of the app. Four digits on a big keypad — the same shape as
 * unlocking the phone itself, which is the one security interaction our users
 * already perform daily.
 *
 * No "forgot your PIN" reset, deliberately: this is the only copy of a
 * household's records and no path here may destroy them. Support is a phone
 * call to Pankaj, and the data is still on the device.
 */
export function PinLock({ onUnlocked }: { onUnlocked: () => void }) {
  const { t } = useTranslation();
  const setup = !isLockSet();

  const [entry, setEntry] = useState('');
  const [confirmEntry, setConfirmEntry] = useState('');
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  // Count the back-off down visibly, so the user knows it is temporary rather
  // than thinking the app has broken.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  const current = stage === 'confirm' ? confirmEntry : entry;
  const setCurrent = stage === 'confirm' ? setConfirmEntry : setEntry;

  useEffect(() => {
    if (current.length !== PIN_LENGTH) return;

    void (async () => {
      if (setup) {
        if (stage === 'enter') {
          setStage('confirm');
          return;
        }
        if (entry !== confirmEntry) {
          setError(t('lock.mismatch'));
          setEntry('');
          setConfirmEntry('');
          setStage('enter');
          return;
        }
        await setPin(entry);
        onUnlocked();
        return;
      }

      const result = await unlock(current);
      if (result.ok) {
        onUnlocked();
        return;
      }
      setError(t('lock.wrong'));
      setWait(result.waitSeconds ?? 0);
      setCurrent('');
    })();
  }, [current, stage, setup, entry, confirmEntry, onUnlocked, setCurrent, t]);

  const press = (digit: string) => {
    if (wait > 0) return;
    setError(null);
    setCurrent(current.length < PIN_LENGTH ? current + digit : current);
  };

  const heading = setup
    ? stage === 'confirm'
      ? t('lock.confirmTitle')
      : t('lock.setTitle')
    : t('lock.title');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-paper px-6 py-10">
      <div className="mt-8 flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="mt-2 max-w-xs text-lg text-ink-soft">
          {setup ? t('lock.setHelp') : t('lock.help')}
        </p>

        {/* Filled dots rather than digits: the number is not readable over a shoulder. */}
        <div className="mt-8 flex gap-4" role="status" aria-label={`${current.length}/${PIN_LENGTH}`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`size-5 rounded-full border-2 ${
                i < current.length ? 'border-brand bg-brand' : 'border-line bg-surface'
              }`}
            />
          ))}
        </div>

        {error ? (
          <p className="mt-4 text-lg font-semibold text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {wait > 0 ? (
          <p className="tabular mt-2 text-lg font-semibold text-danger" role="status">
            {t('lock.wait', { count: wait })}
          </p>
        ) : null}
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <PinKey key={digit} onClick={() => press(digit)} disabled={wait > 0}>
            {digit}
          </PinKey>
        ))}
        <span />
        <PinKey onClick={() => press('0')} disabled={wait > 0}>
          0
        </PinKey>
        <PinKey
          onClick={() => setCurrent(current.slice(0, -1))}
          disabled={wait > 0}
          label={t('numpad.backspace')}
        >
          ←
        </PinKey>
      </div>
    </div>
  );
}

function PinKey({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="tabular flex h-18 items-center justify-center rounded-2xl border-2 border-line bg-surface text-3xl font-bold active:bg-brand-tint disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Re-locks the app after it has been in the background a while, so a phone left
 * on a charpai does not stay open all afternoon.
 */
export function useAutoLock(onLock: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let hiddenAt: number | null = null;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MINUTES * 60_000) onLock();
      hiddenAt = null;
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [onLock, enabled]);
}
