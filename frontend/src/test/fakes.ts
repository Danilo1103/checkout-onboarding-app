import type { CheckoutApi } from '../api/checkoutApi';
import type { Product, Quote, Transaction } from '../api/types';
import type { Services } from '../app/services';

export const aProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-headphones',
  name: 'Aurora Wireless Headphones',
  description: 'Over-ear headphones',
  imageUrl: '/images/headphones.webp',
  priceInCents: 34_990_000,
  availableUnits: 5,
  ...overrides,
});

export const aQuote = (overrides: Partial<Quote> = {}): Quote => ({
  productId: 'prod-headphones',
  quantity: 1,
  currency: 'COP',
  amounts: { productInCents: 34_990_000, baseFeeInCents: 500_000, deliveryFeeInCents: 1_000_000, totalInCents: 36_490_000 },
  ...overrides,
});

export const aTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  reference: 'TX-tx-1',
  status: 'PENDING',
  productId: 'prod-headphones',
  quantity: 1,
  currency: 'COP',
  amounts: aQuote().amounts,
  card: { brand: 'VISA', last4: '4242' },
  createdAt: '2026-09-24T12:00:00.000Z',
  updatedAt: '2026-09-24T12:00:00.000Z',
  ...overrides,
});

export const fakeServices = (api: Partial<CheckoutApi> = {}): Services & { api: jest.Mocked<CheckoutApi> } => ({
  api: {
    getProducts: jest.fn().mockResolvedValue([aProduct()]),
    getQuote: jest.fn().mockResolvedValue(aQuote()),
    getLegalLinks: jest.fn().mockResolvedValue({ termsUrl: 'https://terms.test', personalDataUrl: 'https://data.test' }),
    createTransaction: jest.fn().mockResolvedValue(aTransaction()),
    getTransaction: jest.fn().mockResolvedValue(aTransaction({ status: 'APPROVED' })),
    ...api,
  } as jest.Mocked<CheckoutApi>,
  tokenizeCard: jest.fn().mockResolvedValue({ token: 'tok_1', brand: 'VISA', last4: '4242' }),
  wait: jest.fn().mockResolvedValue(undefined),
});

export const validCard = { number: '4242 4242 4242 4242', holder: 'Ana Gomez', expiry: '12/29', cvc: '123' };
export const validCustomer = { email: 'ana@example.com', fullName: 'Ana Gomez', phone: '3001234567' };
export const validShipping = {
  recipient: 'Ana Gomez',
  phone: '3001234567',
  addressLine: 'Calle 10 # 43-12',
  city: 'Medellín',
  region: 'Antioquia',
  postalCode: '050021',
};

export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}
