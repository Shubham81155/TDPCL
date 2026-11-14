// src/components/common/ThemeToggle.jsx
import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../i18n/LanguageContext';

const NEXT = { light: 'dark', dark: 'system', system: 'light' };
const ICON = { light: 'fa-sun', dark: 'fa-moon', system: 'fa-circle-half-stroke' };

function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const next = NEXT[theme];
  const label = t('common.theme.label', {
    current: t(`common.theme.${theme}`),
    next: t(`common.theme.${next}`),
  });
  return (
    <button
      type="button"
      className={`theme-toggle btn ${className}`.trim()}
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      data-theme-mode={theme}
    >
      <i className={`fas ${ICON[theme]}`} aria-hidden="true"></i>
    </button>
  );
}

export default ThemeToggle;
