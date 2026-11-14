// src/test-utils.js
// Tiny shared render helper: wraps the UI in LanguageProvider (English unless `lang` is given),
// optionally inside a MemoryRouter. Existing tests that render without a provider still work
// because useTranslation() falls back to English.
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';

export function renderWithI18n(ui, { lang = 'en', route, ...options } = {}) {
  const Wrapper = ({ children }) => {
    const inner = <LanguageProvider initialLang={lang}>{children}</LanguageProvider>;
    return route === undefined ? inner : <MemoryRouter initialEntries={[route]}>{inner}</MemoryRouter>;
  };
  return render(ui, { wrapper: Wrapper, ...options });
}
