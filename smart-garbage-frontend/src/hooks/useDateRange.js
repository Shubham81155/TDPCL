// src/hooks/useDateRange.js
// Shared admin date range. Lives in the URL (?from=YYYY-MM-DD&to=YYYY-MM-DD) so links are
// shareable, and is mirrored to sessionStorage so it survives navigation between admin pages.
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const STORAGE_KEY = 'admin.dateRange';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDate = (v) => {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

// Returns { from, to, error } with invalid values dropped.
export const sanitizeRange = (from, to) => {
  const f = isValidDate(from) ? from : '';
  const t = isValidDate(to) ? to : '';
  if (f && t && f > t) {
    return { from: '', to: '', error: 'The "From" date must be on or before the "To" date.' };
  }
  return { from: f, to: t, error: '' };
};

const readStorage = () => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { from: '', to: '' };
    const parsed = JSON.parse(raw);
    const { from, to } = sanitizeRange(parsed?.from, parsed?.to);
    return { from, to };
  } catch (e) {
    return { from: '', to: '' };
  }
};

const writeStorage = (from, to) => {
  try {
    if (!from && !to) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ from, to }));
  } catch (e) {
    /* storage unavailable: URL still works */
  }
};

export const formatDate = (v) => {
  if (!isValidDate(v)) return '';
  return new Date(`${v}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const describeRange = (from, to) => {
  if (from && to) return `${formatDate(from)} - ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Up to ${formatDate(to)}`;
  return 'All time';
};

export default function useDateRange() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');
  const urlHasRange = urlFrom !== null || urlTo !== null;

  const { from, to, error } = useMemo(() => {
    if (urlHasRange) return sanitizeRange(urlFrom, urlTo);
    return { ...readStorage(), error: '' };
  }, [urlFrom, urlTo, urlHasRange]);

  // On arrival without a range in the URL, restore the remembered one into the URL (shareable);
  // when the URL carries a range, remember it.
  useEffect(() => {
    if (urlHasRange) {
      writeStorage(from, to);
      return;
    }
    if (from || to) {
      const next = new URLSearchParams(searchParams);
      if (from) next.set('from', from);
      if (to) next.set('to', to);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(
    (nextFrom, nextTo) => {
      const next = new URLSearchParams(searchParams);
      next.delete('from');
      next.delete('to');
      if (nextFrom) next.set('from', nextFrom);
      if (nextTo) next.set('to', nextTo);
      writeStorage(nextFrom, nextTo);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Returns '' on success or an error message when the range is invalid (and is not applied).
  const setRange = useCallback(
    (nextFrom = '', nextTo = '') => {
      const res = sanitizeRange(nextFrom, nextTo);
      if (res.error) return res.error;
      apply(res.from, res.to);
      return '';
    },
    [apply]
  );

  const clear = useCallback(() => apply('', ''), [apply]);

  const params = useMemo(() => {
    const p = {};
    if (from) p.dateFrom = from;
    if (to) p.dateTo = to;
    return p;
  }, [from, to]);

  return { from, to, error, setRange, clear, params };
}
