// src/services/tokenStorage.js
// Single access point for persisted auth state. Swapping localStorage for
// cookies/memory later is a change to this file only.

const KEYS = { accessToken: 'accessToken', refreshToken: 'refreshToken', user: 'user' };

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
};

const read = (key) => safe(() => window.localStorage.getItem(key));
const write = (key, value) =>
  safe(() => {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  });

export const getAccessToken = () => read(KEYS.accessToken);
export const setAccessToken = (token) => write(KEYS.accessToken, token);
export const getRefreshToken = () => read(KEYS.refreshToken);
export const setRefreshToken = (token) => write(KEYS.refreshToken, token);

export const getUser = () => {
  const raw = read(KEYS.user);
  if (!raw) return null;
  return safe(() => JSON.parse(raw));
};
export const setUser = (user) =>
  write(KEYS.user, user === null || user === undefined ? null : JSON.stringify(user));

export const setTokens = (accessToken, refreshToken) => {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
};

export const clearAuth = () => {
  Object.values(KEYS).forEach((k) => safe(() => window.localStorage.removeItem(k)));
};
