import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import {
  CUSTOMER_REPOSITORY,
  DELIVERY_REPOSITORY,
  PRODUCT_REPOSITORY,
  SETTLEMENT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../application/ports/repositories';
import { PAYMENT_GATEWAY } from '../../application/ports/payment-gateway';
import { APP_CONFIG, loadConfig } from '../../infrastructure/config/app-config';
import {
  aCustomer,
  aShipping,
  FakeGateway,
  InMemoryCustomers,
  InMemoryDb,
  InMemoryDeliveries,
  InMemoryProducts,
  InMemorySettlements,
  InMemoryTransactions,
} from '../../test-utils/in-memory';
import { ok } from '../../domain/shared/result';
import { paymentGatewayError } from '../../domain/shared/errors';
import { err } from '../../domain/shared/result';

const config = loadConfig({
  PAYMENT_API_URL: 'https://gateway.test/v1',
  PAYMENT_PUBLIC_KEY: 'pub',
  PAYMENT_PRIVATE_KEY: 'prv',
  PAYMENT_INTEGRITY_SECRET: 'int',
});

let keyCounter = 0;
const validBody = () => ({
  idempotencyKey: `6f1c2f5e-7c43-4a4e-9a3e-${String((keyCounter += 1)).padStart(12, '0')}`,
  productId: 'p-1',
  quantity: 1,
  customer: aCustomer(),
  shipping: aShipping(),
  card: { token: 'tok_test', brand: 'VISA', last4: '4242', installments: 1 },
  acceptedTerms: true,
  acceptedPersonalData: true,
});

describe('HTTP API', () => {
  let app: INestApplication<App>;
  let db: InMemoryDb;
  let gateway: FakeGateway;

  beforeEach(async () => {
    db = new InMemoryDb();
    gateway = new FakeGateway();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(PRODUCT_REPOSITORY)
      .useValue(new InMemoryProducts(db))
      .overrideProvider(CUSTOMER_REPOSITORY)
      .useValue(new InMemoryCustomers(db))
      .overrideProvider(TRANSACTION_REPOSITORY)
      .useValue(new InMemoryTransactions(db))
      .overrideProvider(DELIVERY_REPOSITORY)
      .useValue(new InMemoryDeliveries(db))
      .overrideProvider(SETTLEMENT_REPOSITORY)
      .useValue(new InMemorySettlements(db))
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(gateway)
      .compile();
    app = configureApp(
      moduleRef.createNestApplication(),
      config,
    ) as INestApplication<App>;
    await app.init();
  });

  afterEach(() => app.close());

  it('sends security headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('lists and gets products', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/products')
      .expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: 'p-1', availableUnits: 10 }),
    ]);
    await request(app.getHttpServer()).get('/api/products/p-1').expect(200);
    const missing = await request(app.getHttpServer())
      .get('/api/products/nope')
      .expect(404);
    expect(missing.body).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('quotes amounts on the server and validates the query', async () => {
    const quote = await request(app.getHttpServer())
      .get('/api/checkout/quote?productId=p-1&quantity=2')
      .expect(200);
    expect(quote.body.amounts).toEqual({
      productInCents: 50_000_000,
      baseFeeInCents: 500_000,
      deliveryFeeInCents: 1_000_000,
      totalInCents: 51_500_000,
    });
    await request(app.getHttpServer())
      .get('/api/checkout/quote?productId=p-1&quantity=0')
      .expect(400);
    const noStock = await request(app.getHttpServer()).get(
      '/api/checkout/quote?productId=p-1&quantity=5',
    );
    expect(noStock.status).toBe(200);
  });

  it('exposes only the acceptance document links', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/checkout/acceptance')
      .expect(200);
    expect(res.body).toEqual({
      termsUrl: 'https://example.com/terms.pdf',
      personalDataUrl: 'https://example.com/personal-data.pdf',
    });
  });

  it('maps gateway failures to 502', async () => {
    gateway.acceptance = err(paymentGatewayError('down'));
    const res = await request(app.getHttpServer())
      .get('/api/checkout/acceptance')
      .expect(502);
    expect(res.body).toMatchObject({ error: 'PAYMENT_GATEWAY' });
  });

  it('upserts customers and rejects unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/api/customers')
      .send(aCustomer())
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .send({ ...aCustomer(), isAdmin: true })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain(
      'property isAdmin should not exist',
    );
  });

  it('runs the whole payment flow: create, poll until approved, get delivery', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/transactions')
      .send(validBody())
      .expect(201);
    expect(created.body).toMatchObject({
      status: 'PENDING',
      card: { brand: 'VISA', last4: '4242' },
    });
    expect(created.body).not.toHaveProperty('shipping');
    expect(created.body).not.toHaveProperty('gatewayTransactionId');

    const polled = await request(app.getHttpServer())
      .get(`/api/transactions/${created.body.id}`)
      .expect(200);
    expect(polled.body.status).toBe('APPROVED');

    const delivery = await request(app.getHttpServer())
      .get(`/api/deliveries/${created.body.id}`)
      .expect(200);
    expect(delivery.body).toMatchObject({
      transactionId: created.body.id,
      status: 'ASSIGNED',
    });

    const products = await request(app.getHttpServer())
      .get('/api/products')
      .expect(200);
    expect(products.body[0].availableUnits).toBe(9);
  });

  it('returns 409 when stock is not enough and 400 for invalid payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/transactions')
      .send({ ...validBody(), acceptedTerms: false })
      .expect(400);
    db.products.set('p-1', { ...db.products.get('p-1')!, reserved: 10 });
    const res = await request(app.getHttpServer())
      .post('/api/transactions')
      .send(validBody())
      .expect(409);
    expect(res.body).toMatchObject({ error: 'OUT_OF_STOCK' });
  });

  it('returns the same transaction when the payment is retried with the same key', async () => {
    const body = validBody();
    const first = await request(app.getHttpServer())
      .post('/api/transactions')
      .send(body)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/api/transactions')
      .send(body)
      .expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(first.body.id).toBe(body.idempotencyKey);
    expect(gateway.charges).toHaveLength(1);
  });

  it('validates ids and reports unknown transactions and deliveries', async () => {
    await request(app.getHttpServer())
      .get('/api/transactions/not-a-uuid')
      .expect(400);
    const id = '6f1c2f5e-7c43-4a4e-9a3e-2f1d8f5f9a10';
    await request(app.getHttpServer())
      .get(`/api/transactions/${id}`)
      .expect(404);
    await request(app.getHttpServer()).get(`/api/deliveries/${id}`).expect(404);
  });

  it('keeps the transaction pending while the gateway is still processing', async () => {
    gateway.statusResult = ok({ id: 'gw-1', status: 'PENDING' });
    const created = await request(app.getHttpServer())
      .post('/api/transactions')
      .send(validBody())
      .expect(201);
    const polled = await request(app.getHttpServer())
      .get(`/api/transactions/${created.body.id}`)
      .expect(200);
    expect(polled.body.status).toBe('PENDING');
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs/json')
      .expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/products',
        '/api/checkout/quote',
        '/api/transactions',
        '/api/transactions/{id}',
      ]),
    );
  });
});
