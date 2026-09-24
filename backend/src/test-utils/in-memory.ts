import {
  CustomerRepository,
  DeliveryRepository,
  ProductRepository,
  SettlementRepository,
  TransactionRepository,
} from '../application/ports/repositories';
import {
  AcceptanceTokens,
  CardChargeRequest,
  GatewayTransaction,
  PaymentGateway,
} from '../application/ports/payment-gateway';
import { Clock, IdGenerator } from '../application/ports/system';
import { Customer } from '../domain/customer';
import { Delivery, ShippingInfo } from '../domain/delivery';
import { Product } from '../domain/product';
import { DomainError, notFound, outOfStock } from '../domain/shared/errors';
import { err, ok, Result } from '../domain/shared/result';
import { Transaction } from '../domain/transaction';

export const aProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Wireless Headphones',
  description: 'Noise cancelling headphones',
  imageUrl: 'https://example.com/headphones.webp',
  priceInCents: 25_000_000,
  stock: 10,
  reserved: 0,
  ...overrides,
});

export const aShipping = (
  overrides: Partial<ShippingInfo> = {},
): ShippingInfo => ({
  recipient: 'Ana Gomez',
  phone: '3001234567',
  addressLine: 'Calle 10 # 43-12',
  city: 'Medellin',
  region: 'Antioquia',
  postalCode: '050021',
  ...overrides,
});

export const aCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  email: 'ana@example.com',
  fullName: 'Ana Gomez',
  phone: '3001234567',
  ...overrides,
});

export class InMemoryDb {
  products = new Map<string, Product>();
  customers = new Map<string, Customer>();
  transactions = new Map<string, Transaction>();
  deliveries = new Map<string, Delivery>();

  constructor(products: Product[] = [aProduct()]) {
    products.forEach((p) => this.products.set(p.id, p));
  }
}

export class InMemoryProducts implements ProductRepository {
  constructor(private readonly db: InMemoryDb) {}

  async findAll(): Promise<Product[]> {
    return [...this.db.products.values()];
  }

  async findById(id: string): Promise<Product | null> {
    return this.db.products.get(id) ?? null;
  }

  async reserve(
    id: string,
    quantity: number,
  ): Promise<Result<void, DomainError>> {
    const product = this.db.products.get(id);
    if (!product) return err(notFound(`Product ${id} not found`));
    if (product.stock - product.reserved < quantity)
      return err(outOfStock('Not enough stock'));
    this.db.products.set(id, {
      ...product,
      reserved: product.reserved + quantity,
    });
    return ok(undefined);
  }
}

export class InMemoryCustomers implements CustomerRepository {
  constructor(private readonly db: InMemoryDb) {}

  async upsert(customer: Customer): Promise<Customer> {
    this.db.customers.set(customer.email, customer);
    return customer;
  }
}

export class InMemoryTransactions implements TransactionRepository {
  constructor(private readonly db: InMemoryDb) {}

  async create(transaction: Transaction): Promise<void> {
    this.db.transactions.set(transaction.id, transaction);
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.db.transactions.get(id) ?? null;
  }

  async attachGatewayId(
    id: string,
    gatewayTransactionId: string,
    updatedAt: string,
  ): Promise<Transaction> {
    const updated = {
      ...this.db.transactions.get(id)!,
      gatewayTransactionId,
      updatedAt,
    };
    this.db.transactions.set(id, updated);
    return updated;
  }
}

export class InMemoryDeliveries implements DeliveryRepository {
  constructor(private readonly db: InMemoryDb) {}

  async findByTransactionId(transactionId: string): Promise<Delivery | null> {
    return (
      [...this.db.deliveries.values()].find(
        (d) => d.transactionId === transactionId,
      ) ?? null
    );
  }
}

export class InMemorySettlements implements SettlementRepository {
  constructor(private readonly db: InMemoryDb) {}

  async settleApproved(
    transaction: Transaction,
    delivery: Delivery,
  ): Promise<void> {
    if (this.db.transactions.get(transaction.id)?.status !== 'PENDING') return;
    const product = this.db.products.get(transaction.productId)!;
    this.db.products.set(product.id, {
      ...product,
      stock: product.stock - transaction.quantity,
      reserved: product.reserved - transaction.quantity,
    });
    this.db.transactions.set(transaction.id, transaction);
    this.db.deliveries.set(delivery.id, delivery);
  }

  async settleRejected(transaction: Transaction): Promise<void> {
    if (this.db.transactions.get(transaction.id)?.status !== 'PENDING') return;
    const product = this.db.products.get(transaction.productId)!;
    this.db.products.set(product.id, {
      ...product,
      reserved: product.reserved - transaction.quantity,
    });
    this.db.transactions.set(transaction.id, transaction);
  }
}

export class FakeGateway implements PaymentGateway {
  chargeResult: Result<GatewayTransaction, DomainError> = ok({
    id: 'gw-1',
    status: 'PENDING',
  });
  statusResult: Result<GatewayTransaction, DomainError> = ok({
    id: 'gw-1',
    status: 'APPROVED',
  });
  acceptance: Result<AcceptanceTokens, DomainError> = ok({
    acceptanceToken: 'acc-token',
    personalDataAuthToken: 'personal-token',
    termsUrl: 'https://example.com/terms.pdf',
    personalDataUrl: 'https://example.com/personal-data.pdf',
  });
  charges: CardChargeRequest[] = [];

  async getAcceptanceTokens() {
    return this.acceptance;
  }

  async chargeCard(request: CardChargeRequest) {
    this.charges.push(request);
    return this.chargeResult;
  }

  async getTransaction() {
    return this.statusResult;
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;
  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly date = new Date('2026-09-24T12:00:00.000Z')) {}
  now(): Date {
    return this.date;
  }
}
