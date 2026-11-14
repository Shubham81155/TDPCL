// src/context/ThemeContext.jsx
// Theme preference: 'light' | 'dark' | 'system'. Persisted in localStorage and applied
// as data-bs-theme on <html> (Bootstrap 5.3 colour modes). public/index.html sets the
// same attribute before React loads to avoid a flash of the wrong theme.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_STORAGE_KEY = 'sgs-theme';
const MODES = ['light', 'dark', 'system'];
const META_COLORS = { light: '#1e7e34', dark: '#0f3d1e' };

const ThemeContext = createContext(null);

const readStored = () => {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return MODES.includes(v) ? v : 'system';
  } catch (e) {
    return 'system';
  }
};

const systemPrefersDark = () => {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {
    return false;
  }
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    } catch (e) {
      mql = null;
    }
    if (!mql || !mql.addEventListener) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', resolvedTheme);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', META_COLORS[resolvedTheme]);
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    if (!MODES.includes(next)) return;
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {
      /* storage blocked: keep in-memory preference only */
    }
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

export default ThemeContext;
