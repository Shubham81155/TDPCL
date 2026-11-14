// src/i18n/LanguageContext.jsx
// Tiny i18n layer (no dependencies). Usage:
//   const { t, lang, setLang, languages, formatDate } = useTranslation();
//   t('citizen.dashboard.welcome', { name })
// The language defaults to English and is only changed by the user (it is NOT guessed from
// navigator.language). The choice is stored in localStorage under 'sgs-lang' and mirrored to
// <html lang>. Components rendered without a provider (e.g. in older unit tests) get English.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CATALOGS, DEFAULT_LANG_CODE, LANGUAGES, LANG_CODES } from './languages';
import { createTranslator } from './translate';

export const LANG_STORAGE_KEY = 'sgs-lang';

const findLanguage = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

const readStored = () => {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return LANG_CODES.includes(v) ? v : DEFAULT_LANG_CODE;
  } catch (e) {
    return DEFAULT_LANG_CODE;
  }
};

const buildValue = (lang, setLang) => {
  const meta = findLanguage(lang);
  const toDate = (value) => (value instanceof Date ? value : new Date(value));
  return {
    t: createTranslator(meta.code, CATALOGS),
    lang: meta.code,
    setLang,
    languages: LANGUAGES,
    locale: meta.locale,
    // Date helpers; English keeps the browser-default format used before i18n existed.
    formatDate: (value, options) => toDate(value).toLocaleDateString(meta.dateLocale, options),
    formatDateTime: (value, options) => toDate(value).toLocaleString(meta.dateLocale, options),
    formatNumber: (value, options) => new Intl.NumberFormat(meta.locale, options).format(value),
  };
};

// Used when no provider is mounted: English, setLang is a no-op.
const FALLBACK_VALUE = buildValue(DEFAULT_LANG_CODE, () => {});

const LanguageContext = createContext(FALLBACK_VALUE);

/**
 * @param {string} [initialLang] force the starting language (tests); otherwise localStorage / English.
 */
export function LanguageProvider({ children, initialLang }) {
  const [lang, setLangState] = useState(() =>
    initialLang && LANG_CODES.includes(initialLang) ? initialLang : readStored()
  );

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANG_CODES.includes(next)) return;
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch (e) {
      /* storage blocked: keep the in-memory choice only */
    }
  }, []);

  const value = useMemo(() => buildValue(lang, setLang), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const useTranslation = useLanguage;

export default LanguageContext;
