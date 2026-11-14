import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from '../ThemeContext';

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="t">{theme}</span>
      <span data-testid="r">{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
    </div>
  );
}

const mockMatchMedia = (matches) => {
  window.matchMedia = jest.fn().mockImplementation((q) => ({
    matches,
    media: q,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
};

const renderIt = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );

describe('ThemeContext', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  it('defaults to system (light when the OS is light) and sets data-bs-theme', () => {
    renderIt();
    expect(screen.getByTestId('t')).toHaveTextContent('system');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
  });

  it('system resolves to dark when the OS prefers dark', () => {
    mockMatchMedia(true);
    renderIt();
    expect(screen.getByTestId('r')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('persists the choice and restores it', () => {
    const { unmount } = renderIt();
    act(() => screen.getByText('dark').click());
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    unmount();
    renderIt();
    expect(screen.getByTestId('t')).toHaveTextContent('dark');
  });

  it('updates meta theme-color', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
    renderIt();
    act(() => screen.getByText('dark').click());
    expect(meta.getAttribute('content')).toBe('#0f3d1e');
    act(() => screen.getByText('light').click());
    expect(meta.getAttribute('content')).toBe('#1e7e34');
    meta.remove();
  });

  it('works when localStorage is blocked', () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderIt();
    expect(screen.getByTestId('t')).toHaveTextContent('system');
    act(() => screen.getByText('dark').click());
    expect(screen.getByTestId('t')).toHaveTextContent('dark');
    get.mockRestore();
    set.mockRestore();
  });

  it('ignores invalid stored values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    renderIt();
    expect(screen.getByTestId('t')).toHaveTextContent('system');
  });
});
