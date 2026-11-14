import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import useDateRange, { STORAGE_KEY, sanitizeRange } from '../useDateRange';

let currentSearch = '';
const Spy = () => {
  currentSearch = useLocation().search;
  return null;
};
const makeWrapper = (initial) => ({ children }) => (
  <MemoryRouter initialEntries={[initial]}>
    <Spy />
    {children}
  </MemoryRouter>
);

beforeEach(() => {
  window.sessionStorage.clear();
  currentSearch = '';
});

describe('useDateRange', () => {
  it('reads the range from the URL and exposes API params', () => {
    const { result } = renderHook(() => useDateRange(), {
      wrapper: makeWrapper('/admin?from=2026-01-01&to=2026-01-31'),
    });
    expect(result.current.from).toBe('2026-01-01');
    expect(result.current.to).toBe('2026-01-31');
    expect(result.current.params).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY))).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });

  it('setRange updates URL (keeping other params) and sessionStorage; clear removes both', () => {
    const { result } = renderHook(() => useDateRange(), { wrapper: makeWrapper('/admin?category=paper') });
    expect(result.current.params).toEqual({});
    act(() => {
      expect(result.current.setRange('2026-02-01', '2026-02-10')).toBe('');
    });
    expect(currentSearch).toContain('from=2026-02-01');
    expect(currentSearch).toContain('to=2026-02-10');
    expect(currentSearch).toContain('category=paper');
    expect(result.current.params.dateFrom).toBe('2026-02-01');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('2026-02-01');

    act(() => result.current.clear());
    expect(currentSearch).toBe('?category=paper');
    expect(result.current.from).toBe('');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restores the remembered range from sessionStorage into the URL', () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ from: '2026-03-01', to: '2026-03-05' }));
    const { result } = renderHook(() => useDateRange(), { wrapper: makeWrapper('/admin/analytics') });
    expect(result.current.from).toBe('2026-03-01');
    expect(currentSearch).toContain('from=2026-03-01');
    expect(currentSearch).toContain('to=2026-03-05');
  });

  it('rejects from > to and ignores malformed dates', () => {
    const { result } = renderHook(() => useDateRange(), { wrapper: makeWrapper('/admin') });
    let msg;
    act(() => {
      msg = result.current.setRange('2026-05-10', '2026-05-01');
    });
    expect(msg).toMatch(/on or before/);
    expect(result.current.from).toBe('');
    expect(currentSearch).toBe('');

    expect(sanitizeRange('nope', '2026-02-30')).toEqual({ from: '', to: '', error: '' });
    const bad = renderHook(() => useDateRange(), {
      wrapper: makeWrapper('/admin?from=2026-06-10&to=2026-06-01'),
    });
    expect(bad.result.current.params).toEqual({});
    expect(bad.result.current.error).toMatch(/on or before/);
  });
});
