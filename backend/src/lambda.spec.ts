const loadSecrets = jest.fn().mockResolvedValue(undefined);
const expressHandler = jest.fn().mockResolvedValue({ statusCode: 200 });
const serverlessExpress = jest.fn().mockReturnValue(expressHandler);

jest.mock('./infrastructure/config/load-secrets', () => ({ loadSecrets }));
jest.mock('@codegenie/serverless-express', () => ({
  __esModule: true,
  default: serverlessExpress,
}));

import { handler } from './lambda';

describe('lambda handler', () => {
  beforeAll(() => {
    Object.assign(process.env, {
      PAYMENT_API_URL: 'https://gateway.test/v1',
      PAYMENT_PUBLIC_KEY: 'pub',
      PAYMENT_PRIVATE_KEY: 'prv',
      PAYMENT_INTEGRITY_SECRET: 'int',
    });
  });

  it('boots Nest once, loading secrets first, and reuses the server', async () => {
    const event = { rawPath: '/health' };
    await expect(handler(event, {} as never, jest.fn())).resolves.toEqual({
      statusCode: 200,
    });
    await handler(event, {} as never, jest.fn());

    expect(loadSecrets).toHaveBeenCalledTimes(1);
    expect(serverlessExpress).toHaveBeenCalledTimes(1);
    expect(expressHandler).toHaveBeenCalledTimes(2);
    expect(serverlessExpress.mock.calls[0][0].app.get('trust proxy')).toBe(1);
  });
});
