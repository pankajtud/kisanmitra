import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { clearPin, isLockSet } from '../../db/lock.js';
import { LOCALES, setLocale, type Locale } from '../../i18n/index.js';

/**
 * Settings: reference data, language, and the PIN.
 *
 * Removing the PIN is offered plainly rather than hidden, because a household
 * that shares one phone between people who all need the records may genuinely
 * not want a gate. It is their call, and the copy says what it costs.
 */
export function SettingsScreen({
  onFields,
  onStores,
  onLock,
  onBack,
}: {
  onFields: () => void;
  onStores: () => void;
  /** Re-lock now, which is also how the PIN gets changed. */
  onLock: () => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [hasPin, setHasPin] = useState(isLockSet());

  return (
    <Screen title={t('settings.title')} onBack={onBack}>
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="label">{t('settings.fields')}</h2>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={onFields} className="btn-secondary w-full">
              {t('fields.title')}
            </button>
            <button type="button" onClick={onStores} className="btn-secondary w-full">
              {t('stores.title')}
            </button>
          </div>
        </section>

        <section>
          <h2 className="label">{t('settings.language')}</h2>
          <div className="flex gap-2">
            {LOCALES.map((locale: Locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => setLocale(locale)}
                aria-pressed={i18n.language === locale}
                className={i18n.language === locale ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              >
                {locale === 'hi' ? 'हिन्दी' : 'English'}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="label">{t('lock.protection')}</h2>
          <p className="mb-2 text-base text-ink-soft">{t('lock.help')}</p>

          {hasPin ? (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={onLock} className="btn-secondary w-full">
                {t('lock.title')}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPin();
                  setHasPin(false);
                }}
                className="btn-quiet w-full text-danger"
              >
                {t('lock.remove')}
              </button>
            </div>
          ) : (
            <button type="button" onClick={onLock} className="btn-primary w-full">
              {t('lock.setTitle')}
            </button>
          )}
        </section>
      </div>
    </Screen>
  );
}
