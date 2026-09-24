import { Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  CUSTOMER_REPOSITORY,
  CustomerRepository,
  DELIVERY_REPOSITORY,
  DeliveryRepository,
  PRODUCT_REPOSITORY,
  ProductRepository,
  SETTLEMENT_REPOSITORY,
  SettlementRepository,
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from './application/ports/repositories';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './application/ports/payment-gateway';
import {
  CHECKOUT_FEES,
  CheckoutFees,
  CLOCK,
  Clock,
  ID_GENERATOR,
  IdGenerator,
} from './application/ports/system';
import { CreateTransaction } from './application/use-cases/create-transaction';
import { GetAcceptanceTokens } from './application/use-cases/get-acceptance-tokens';
import { GetCheckoutQuote } from './application/use-cases/get-checkout-quote';
import { GetDelivery } from './application/use-cases/get-delivery';
import { GetProduct } from './application/use-cases/get-product';
import { ListProducts } from './application/use-cases/list-products';
import { SettleTransaction } from './application/use-cases/settle-transaction';
import { SyncTransaction } from './application/use-cases/sync-transaction';
import { UpsertCustomer } from './application/use-cases/upsert-customer';
import {
  APP_CONFIG,
  AppConfig,
  loadConfig,
} from './infrastructure/config/app-config';
import {
  createDynamoClient,
  DYNAMO_CLIENT,
} from './infrastructure/dynamodb/client';
import { DynamoCustomerRepository } from './infrastructure/dynamodb/dynamo-customer.repository';
import { DynamoDeliveryRepository } from './infrastructure/dynamodb/dynamo-delivery.repository';
import { DynamoProductRepository } from './infrastructure/dynamodb/dynamo-product.repository';
import { DynamoSettlementRepository } from './infrastructure/dynamodb/dynamo-settlement.repository';
import { DynamoTransactionRepository } from './infrastructure/dynamodb/dynamo-transaction.repository';
import { HttpPaymentGateway } from './infrastructure/payment-gateway/http-payment-gateway';
import { SystemClock, UuidGenerator } from './infrastructure/system/system';
import { CheckoutController } from './interfaces/http/checkout.controller';
import { CustomersController } from './interfaces/http/customers.controller';
import { DeliveriesController } from './interfaces/http/deliveries.controller';
import { HealthController } from './interfaces/http/health.controller';
import { ProductsController } from './interfaces/http/products.controller';
import { TransactionsController } from './interfaces/http/transactions.controller';
import { USE_CASES } from './interfaces/http/tokens';

/** Adapters: the only place that knows about DynamoDB and the payment gateway HTTP API. */
const adapters: Provider[] = [
  { provide: APP_CONFIG, useFactory: () => loadConfig() },
  {
    provide: DYNAMO_CLIENT,
    inject: [APP_CONFIG],
    useFactory: createDynamoClient,
  },
  { provide: ID_GENERATOR, useClass: UuidGenerator },
  { provide: CLOCK, useClass: SystemClock },
  {
    provide: CHECKOUT_FEES,
    inject: [APP_CONFIG],
    useFactory: (c: AppConfig) => c.fees,
  },
  {
    provide: PRODUCT_REPOSITORY,
    inject: [DYNAMO_CLIENT, APP_CONFIG],
    useFactory: (db: DynamoDBDocumentClient, c: AppConfig) =>
      new DynamoProductRepository(db, c.tables.products),
  },
  {
    provide: CUSTOMER_REPOSITORY,
    inject: [DYNAMO_CLIENT, APP_CONFIG, CLOCK],
    useFactory: (db: DynamoDBDocumentClient, c: AppConfig, clock: Clock) =>
      new DynamoCustomerRepository(db, c.tables.customers, clock),
  },
  {
    provide: TRANSACTION_REPOSITORY,
    inject: [DYNAMO_CLIENT, APP_CONFIG],
    useFactory: (db: DynamoDBDocumentClient, c: AppConfig) =>
      new DynamoTransactionRepository(db, c.tables.transactions),
  },
  {
    provide: DELIVERY_REPOSITORY,
    inject: [DYNAMO_CLIENT, APP_CONFIG],
    useFactory: (db: DynamoDBDocumentClient, c: AppConfig) =>
      new DynamoDeliveryRepository(db, c.tables.deliveries),
  },
  {
    provide: SETTLEMENT_REPOSITORY,
    inject: [DYNAMO_CLIENT, APP_CONFIG],
    useFactory: (db: DynamoDBDocumentClient, c: AppConfig) =>
      new DynamoSettlementRepository(db, c.tables),
  },
  {
    provide: PAYMENT_GATEWAY,
    inject: [APP_CONFIG],
    useFactory: (c: AppConfig) => new HttpPaymentGateway(c.payment),
  },
];

/** Use cases depend only on ports, never on concrete adapters. */
const useCases: Provider[] = [
  {
    provide: USE_CASES.listProducts,
    inject: [PRODUCT_REPOSITORY],
    useFactory: (p: ProductRepository) => new ListProducts(p),
  },
  {
    provide: USE_CASES.getProduct,
    inject: [PRODUCT_REPOSITORY],
    useFactory: (p: ProductRepository) => new GetProduct(p),
  },
  {
    provide: USE_CASES.getQuote,
    inject: [PRODUCT_REPOSITORY, CHECKOUT_FEES],
    useFactory: (p: ProductRepository, fees: CheckoutFees) =>
      new GetCheckoutQuote(p, fees),
  },
  {
    provide: USE_CASES.getAcceptance,
    inject: [PAYMENT_GATEWAY],
    useFactory: (g: PaymentGateway) => new GetAcceptanceTokens(g),
  },
  {
    provide: USE_CASES.upsertCustomer,
    inject: [CUSTOMER_REPOSITORY],
    useFactory: (c: CustomerRepository) => new UpsertCustomer(c),
  },
  {
    provide: SettleTransaction,
    inject: [SETTLEMENT_REPOSITORY, ID_GENERATOR, CLOCK],
    useFactory: (s: SettlementRepository, ids: IdGenerator, clock: Clock) =>
      new SettleTransaction(s, ids, clock),
  },
  {
    provide: USE_CASES.createTransaction,
    inject: [
      USE_CASES.getQuote,
      USE_CASES.upsertCustomer,
      PRODUCT_REPOSITORY,
      TRANSACTION_REPOSITORY,
      PAYMENT_GATEWAY,
      SettleTransaction,
      CLOCK,
    ],
    useFactory: (
      quote: GetCheckoutQuote,
      customers: UpsertCustomer,
      products: ProductRepository,
      transactions: TransactionRepository,
      gateway: PaymentGateway,
      settle: SettleTransaction,
      clock: Clock,
    ) =>
      new CreateTransaction(
        quote,
        customers,
        products,
        transactions,
        gateway,
        settle,
        clock,
      ),
  },
  {
    provide: USE_CASES.syncTransaction,
    inject: [TRANSACTION_REPOSITORY, PAYMENT_GATEWAY, SettleTransaction],
    useFactory: (
      t: TransactionRepository,
      g: PaymentGateway,
      s: SettleTransaction,
    ) => new SyncTransaction(t, g, s),
  },
  {
    provide: USE_CASES.getDelivery,
    inject: [DELIVERY_REPOSITORY],
    useFactory: (d: DeliveryRepository) => new GetDelivery(d),
  },
];

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    HealthController,
    ProductsController,
    CheckoutController,
    CustomersController,
    TransactionsController,
    DeliveriesController,
  ],
  providers: [
    ...adapters,
    ...useCases,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
