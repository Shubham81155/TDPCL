// src/components/common/LanguageSwitcher.jsx
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

// Compact language <select>. Options are labelled in their own language so a user who
// cannot read the current language can still find theirs.
function LanguageSwitcher({ className = '' }) {
  const { t, lang, setLang, languages } = useTranslation();
  return (
    <select
      className={`language-switcher form-select form-select-sm ${className}`.trim()}
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label={t('nav.language')}
      title={t('nav.language')}
    >
      {languages.map((l) => (
        <option key={l.code} value={l.code} lang={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

export default LanguageSwitcher;
