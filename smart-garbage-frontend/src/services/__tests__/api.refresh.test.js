import axios from 'axios';
import apiClient from '../api';
import { setTokens, getAccessToken } from '../tokenStorage';

describe('api 401 refresh', () => {
  let refreshCalls;
  let refreshSpy;

  beforeEach(() => {
    refreshCalls = 0;
    setTokens('old', 'refresh-1');
    refreshSpy = jest.spyOn(axios, 'post').mockImplementation(async (url) => {
      if (/\/auth\/refresh/.test(url)) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return { data: { accessToken: 'new', refreshToken: 'refresh-2' } };
      }
      throw new Error('unexpected ' + url);
    });
    // Adapter: 401 unless the new token is presented
    apiClient.defaults.adapter = async (config) => {
      const ok = config.headers.Authorization === 'Bearer new';
      const response = { data: { ok }, status: ok ? 200 : 401, statusText: '', headers: {}, config };
      if (ok) return response;
      const err = new Error('Unauthorized');
      err.config = config;
      err.response = response;
      err.isAxiosError = true;
      throw err;
    };
  });

  afterEach(() => refreshSpy.mockRestore());

  it('shares a single refresh request between concurrent 401s', async () => {
    const results = await Promise.all([
      apiClient.get('/a'),
      apiClient.get('/b'),
      apiClient.get('/c'),
    ]);
    expect(results.every((r) => r.data.ok)).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe('new');
  });
});
