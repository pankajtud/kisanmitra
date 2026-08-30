/**
 * `hi` is the default and the fallback; `en` exists for Pankaj and for
 * debugging (CLAUDE.md §11).
 *
 * Both locales are bundled rather than lazily fetched — they are a couple of KB
 * and a language switch must work with no network.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import hi from './locales/hi.json';
import en from './locales/en.json';

export const LOCALES = ['hi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const STORAGE_KEY = 'km.locale';

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'hi' || saved === 'en') return saved;
  } catch {
    // Private mode or blocked storage. Hindi is the right default anyway.
  }
  return 'hi';
}

void i18next.use(initReactI18next).init({
  resources: { hi: { translation: hi }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: 'hi',
  interpolation: { escapeValue: false },
  // In dev a missing key renders as the key itself, so gaps are obvious.
  // In prod it falls back to Hindi rather than showing a key to a farmer (§11).
  parseMissingKeyHandler: (key) => (import.meta.env.DEV ? key : ''),
  returnEmptyString: false,
});

export function setLocale(locale: Locale) {
  void i18next.changeLanguage(locale);
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not being able to remember the choice is not a reason to refuse it.
  }
}

document.documentElement.lang = i18next.language;

export default i18next;
