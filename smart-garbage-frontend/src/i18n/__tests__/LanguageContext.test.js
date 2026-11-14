import { act, render, screen } from '@testing-library/react';
import { LanguageProvider, LANG_STORAGE_KEY, useTranslation } from '../LanguageContext';

function Probe() {
  const { t, lang, setLang, formatDate } = useTranslation();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="text">{t('nav.dashboard')}</span>
      <span data-testid="date">{formatDate('2024-03-05T10:00:00Z')}</span>
      <button onClick={() => setLang('hi')}>to-hi</button>
      <button onClick={() => setLang('en')}>to-en</button>
      <button onClick={() => setLang('xx')}>to-bad</button>
    </div>
  );
}

const renderProbe = (props = {}) =>
  render(
    <LanguageProvider {...props}>
      <Probe />
    </LanguageProvider>
  );

beforeEach(() => {
  document.documentElement.removeAttribute('lang');
});

describe('LanguageProvider', () => {
  it('defaults to English and does not follow navigator.language', () => {
    const spy = jest.spyOn(window.navigator, 'language', 'get').mockReturnValue('hi-IN');
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    spy.mockRestore();
  });

  it('switches language, persists it and updates <html lang>', () => {
    renderProbe();
    act(() => screen.getByText('to-hi').click());
    expect(screen.getByTestId('lang')).toHaveTextContent('hi');
    expect(screen.getByTestId('text')).toHaveTextContent('डैशबोर्ड');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('hi');
    expect(document.documentElement.lang).toBe('hi');

    act(() => screen.getByText('to-en').click());
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores the stored language on mount', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'hi');
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('hi');
    expect(document.documentElement.lang).toBe('hi');
  });

  it('ignores an unknown stored value and unknown setLang codes', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'zz');
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    act(() => screen.getByText('to-bad').click());
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('accepts initialLang (for tests) without touching storage', () => {
    renderProbe({ initialLang: 'hi' });
    expect(screen.getByTestId('lang')).toHaveTextContent('hi');
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBeNull();
  });

  it('still works when localStorage is blocked', () => {
    const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    act(() => screen.getByText('to-hi').click());
    expect(screen.getByTestId('lang')).toHaveTextContent('hi');
    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it('formats dates with the active locale', () => {
    renderProbe({ initialLang: 'hi' });
    expect(screen.getByTestId('date').textContent).toBe(
      new Date('2024-03-05T10:00:00Z').toLocaleDateString('hi-IN')
    );
  });

  it('gives English without a provider', () => {
    render(<Probe />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
