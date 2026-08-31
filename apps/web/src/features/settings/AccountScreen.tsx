import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { currentAccount, joinWithCode, requestCode, signIn, signOut, type Account } from '../../db/session.js';
import { pendingCount } from '../../db/outbox.js';

/**
 * Signing in, so this household's records live somewhere besides one phone.
 *
 * Phone number and a six-digit code — no email, no password, ever (§12). Being
 * signed out is not an error state: the app worked for months without a server
 * and still does. Signing in only adds a second place the records live.
 */
export function AccountScreen({ onBack, onSignedIn }: { onBack: () => void; onSignedIn: () => void }) {
  const { t } = useTranslation();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    void currentAccount().then(setAccount);
    void pendingCount().then(setWaiting);
  }, []);

  const send = async () => {
    setBusy(true);
    setError(null);
    const result = await requestCode(phone.trim());
    setBusy(false);
    if (result.ok) setStage('code');
    else setError(t('account.sendFailed'));
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const result = await signIn(phone.trim(), code.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'code' ? t('account.wrongCode') : t('account.sendFailed'));
      return;
    }
    setAccount(result.account ?? null);
    setQueued(result.queued ?? 0);
    onSignedIn();
  };

  if (account === undefined) {
    return (
      <Screen title={t('account.title')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  if (account) {
    return (
      <Screen title={t('account.title')} onBack={onBack}>
        <div className="flex flex-col gap-5">
          <div className="card px-5 py-4">
            <span className="block text-base font-semibold text-ink-soft">{t('account.signedIn')}</span>
            <span className="tabular mt-1 block text-lg font-bold">{phone || account.userId.slice(0, 8)}</span>
            {queued !== null && queued > 0 ? (
              <p className="mt-2 text-base text-ink-soft">{t('account.queued', { count: queued })}</p>
            ) : null}
          </div>

          {/* Joining the family's books, with a code shared over WhatsApp. */}
          <section>
            <label className="label" htmlFor="invite">
              {t('account.joinLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id="invite"
                type="text"
                inputMode="numeric"
                value={invite}
                onChange={(event) => setInvite(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="input tabular flex-1 text-center text-2xl"
                placeholder="000000"
              />
              <button
                type="button"
                disabled={invite.length !== 6}
                onClick={() => void joinWithCode(invite).then((ok) => setError(ok ? null : t('account.badInvite')))}
                className="btn-secondary px-5"
              >
                {t('account.join')}
              </button>
            </div>
          </section>

          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void signOut().then(() => setAccount(null))}
            className="btn-quiet w-full text-danger"
          >
            {t('account.signOut')}
          </button>

          {/* Signing out never touches the records. */}
          <p className="text-base text-ink-soft">{t('account.signOutSafe')}</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title={t('account.title')} onBack={onBack}>
      <div className="flex flex-col gap-5">
        <p className="text-lg text-ink-soft">{t('account.why')}</p>
        {waiting > 0 ? (
          <p className="card px-4 py-3 text-base text-ink-soft">
            {t('account.waitingHere', { count: waiting })}
          </p>
        ) : null}

        {stage === 'phone' ? (
          <>
            <label className="label" htmlFor="phone">
              {t('account.phoneLabel')}
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91"
              className="input tabular text-2xl"
            />
            <button
              type="button"
              disabled={busy || phone.trim().length < 8}
              onClick={() => void send()}
              className="btn-primary w-full text-xl"
            >
              {t('account.sendCode')}
            </button>
          </>
        ) : (
          <>
            <label className="label" htmlFor="code">
              {t('account.codeLabel', { phone })}
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              className="input tabular text-center text-3xl"
              placeholder="000000"
            />
            <button
              type="button"
              disabled={busy || code.length !== 6}
              onClick={() => void verify()}
              className="btn-primary w-full text-xl"
            >
              {t('account.signIn')}
            </button>
            <button type="button" onClick={() => setStage('phone')} className="btn-quiet w-full">
              {t('account.changeNumber')}
            </button>
          </>
        )}

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
