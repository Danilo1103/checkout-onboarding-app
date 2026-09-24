import { env } from './env';

type RuntimeConfig = Partial<typeof env>;

/**
 * Deployed builds read `/config.json`, written by the infrastructure with the
 * API URL and the public payment key, so the same bundle works in any
 * environment. Missing or invalid files keep the build-time values.
 */
export const loadRuntimeConfig = async (fetchFn: typeof fetch = fetch): Promise<void> => {
  try {
    const response = await fetchFn('/config.json', { cache: 'no-store' });
    if (!response.ok) return;
    const config = (await response.json()) as RuntimeConfig;
    for (const key of Object.keys(env) as (keyof typeof env)[]) {
      if (typeof config[key] === 'string' && config[key]) env[key] = config[key];
    }
  } catch {
    // Keep build-time configuration.
  }
};
