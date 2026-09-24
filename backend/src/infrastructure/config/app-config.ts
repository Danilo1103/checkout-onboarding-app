export interface AppConfig {
  readonly port: number;
  readonly corsOrigins: string[];
  readonly aws: { readonly region: string; readonly dynamoEndpoint?: string };
  readonly tables: {
    readonly products: string;
    readonly customers: string;
    readonly transactions: string;
    readonly deliveries: string;
  };
  readonly payment: {
    readonly apiUrl: string;
    readonly publicKey: string;
    readonly privateKey: string;
    readonly integritySecret: string;
    readonly timeoutMs: number;
  };
  readonly fees: {
    readonly baseFeeInCents: number;
    readonly deliveryFeeInCents: number;
  };
}

export const APP_CONFIG = Symbol('AppConfig');

const REQUIRED = [
  'PAYMENT_API_URL',
  'PAYMENT_PUBLIC_KEY',
  'PAYMENT_PRIVATE_KEY',
  'PAYMENT_INTEGRITY_SECRET',
] as const;

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
  const prefix = env.TABLE_PREFIX ?? 'checkout';
  return {
    port: toInt(env.PORT, 3000),
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
    aws: {
      region: env.AWS_REGION ?? 'us-east-1',
      dynamoEndpoint: env.DYNAMODB_ENDPOINT || undefined,
    },
    tables: {
      products: `${prefix}-products`,
      customers: `${prefix}-customers`,
      transactions: `${prefix}-transactions`,
      deliveries: `${prefix}-deliveries`,
    },
    payment: {
      apiUrl: env.PAYMENT_API_URL!.replace(/\/$/, ''),
      publicKey: env.PAYMENT_PUBLIC_KEY!,
      privateKey: env.PAYMENT_PRIVATE_KEY!,
      integritySecret: env.PAYMENT_INTEGRITY_SECRET!,
      timeoutMs: toInt(env.PAYMENT_TIMEOUT_MS, 10_000),
    },
    fees: {
      baseFeeInCents: toInt(env.BASE_FEE_IN_CENTS, 500_000),
      deliveryFeeInCents: toInt(env.DELIVERY_FEE_IN_CENTS, 1_000_000),
    },
  };
};
