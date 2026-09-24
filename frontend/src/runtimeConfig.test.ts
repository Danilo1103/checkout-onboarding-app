import { env } from './env';
import { loadRuntimeConfig } from './runtimeConfig';

const original = { ...env };
afterEach(() => Object.assign(env, original));

describe('loadRuntimeConfig', () => {
  it('overrides known string values from /config.json', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ apiUrl: 'https://api.prod', paymentPublicKey: '', unknown: 'x' }),
    });
    await loadRuntimeConfig(fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('/config.json', { cache: 'no-store' });
    expect(env).toEqual({ ...original, apiUrl: 'https://api.prod' });
  });

  it('keeps build-time values when the file is missing or broken', async () => {
    await loadRuntimeConfig(jest.fn().mockResolvedValue({ ok: false }));
    await loadRuntimeConfig(jest.fn().mockRejectedValue(new Error('offline')));
    expect(env).toEqual(original);
  });
});
