import * as ts from '../tokenStorage';

describe('tokenStorage', () => {
  it('round-trips tokens and user', () => {
    ts.setTokens('a', 'r');
    ts.setUser({ name: 'X' });
    expect(ts.getAccessToken()).toBe('a');
    expect(ts.getRefreshToken()).toBe('r');
    expect(ts.getUser()).toEqual({ name: 'X' });
  });

  it('clearAuth removes everything', () => {
    ts.setTokens('a', 'r');
    ts.setUser({ name: 'X' });
    ts.clearAuth();
    expect(ts.getAccessToken()).toBeNull();
    expect(ts.getRefreshToken()).toBeNull();
    expect(ts.getUser()).toBeNull();
  });

  it('returns null for corrupt user JSON', () => {
    window.localStorage.setItem('user', '{bad');
    expect(ts.getUser()).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    const g = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    const s = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    const r = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
    expect(ts.getAccessToken()).toBeNull();
    expect(() => ts.setTokens('a', 'r')).not.toThrow();
    expect(() => ts.clearAuth()).not.toThrow();
    g.mockRestore();
    s.mockRestore();
    r.mockRestore();
  });
});
