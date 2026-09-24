import { loadConfig } from './app-config';

const required = {
  PAYMENT_API_URL: 'https://gateway.test/v1/',
  PAYMENT_PUBLIC_KEY: 'pub',
  PAYMENT_PRIVATE_KEY: 'prv',
  PAYMENT_INTEGRITY_SECRET: 'int',
};

describe('loadConfig', () => {
  it('fails fast when required variables are missing', () => {
    expect(() => loadConfig({})).toThrow(
      'Missing required environment variables: PAYMENT_API_URL',
    );
  });

  it('applies defaults', () => {
    const config = loadConfig(required);
    expect(config).toMatchObject({
      port: 3000,
      corsOrigins: ['http://localhost:5173'],
      aws: { region: 'us-east-1', dynamoEndpoint: undefined },
      tables: {
        products: 'checkout-products',
        deliveries: 'checkout-deliveries',
      },
      payment: { apiUrl: 'https://gateway.test/v1', timeoutMs: 10000 },
      fees: { baseFeeInCents: 500000, deliveryFeeInCents: 1000000 },
    });
  });

  it('reads overrides', () => {
    const config = loadConfig({
      ...required,
      PORT: '4000',
      CORS_ORIGIN: 'https://a.test, https://b.test',
      AWS_REGION: 'us-west-2',
      DYNAMODB_ENDPOINT: 'http://localhost:8000',
      TABLE_PREFIX: 'prod',
      BASE_FEE_IN_CENTS: '100',
      DELIVERY_FEE_IN_CENTS: 'abc',
    });
    expect(config).toMatchObject({
      port: 4000,
      corsOrigins: ['https://a.test', 'https://b.test'],
      aws: { region: 'us-west-2', dynamoEndpoint: 'http://localhost:8000' },
      tables: { transactions: 'prod-transactions' },
      fees: { baseFeeInCents: 100, deliveryFeeInCents: 1000000 },
    });
  });
});
