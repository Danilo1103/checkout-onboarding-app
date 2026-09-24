import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { aProduct, aShipping, FixedClock } from '../../test-utils/in-memory';
import { Transaction } from '../../domain/transaction';
import { Delivery } from '../../domain/delivery';
import { createDynamoClient, isConditionalFailure } from './client';
import { DynamoCustomerRepository } from './dynamo-customer.repository';
import { DynamoDeliveryRepository } from './dynamo-delivery.repository';
import { DynamoProductRepository } from './dynamo-product.repository';
import { DynamoSettlementRepository } from './dynamo-settlement.repository';
import { DynamoTransactionRepository } from './dynamo-transaction.repository';

const ddb = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'us-east-1' }),
);
const tables = {
  products: 'products',
  customers: 'customers',
  transactions: 'transactions',
  deliveries: 'deliveries',
};

const conditionalError = () =>
  Object.assign(new Error('failed'), {
    name: 'ConditionalCheckFailedException',
  });
const cancelled = (code: string) =>
  Object.assign(new Error('cancelled'), {
    name: 'TransactionCanceledException',
    CancellationReasons: [{ Code: code }],
  });

const aTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  reference: 'TX-tx-1',
  productId: 'p-1',
  quantity: 2,
  customerEmail: 'ana@example.com',
  amounts: {
    productInCents: 100,
    baseFeeInCents: 10,
    deliveryFeeInCents: 20,
    totalInCents: 130,
  },
  currency: 'COP',
  status: 'APPROVED',
  cardBrand: 'VISA',
  cardLast4: '4242',
  shipping: aShipping(),
  createdAt: '2026-09-24T12:00:00.000Z',
  updatedAt: '2026-09-24T12:00:00.000Z',
  ...overrides,
});

beforeEach(() => ddb.reset());

describe('client helpers', () => {
  it('creates a client for AWS or for DynamoDB Local', () => {
    const base = { aws: { region: 'us-east-1' } } as never;
    const local = {
      aws: { region: 'us-east-1', dynamoEndpoint: 'http://localhost:8000' },
    } as never;
    expect(createDynamoClient(base)).toBeInstanceOf(DynamoDBDocumentClient);
    expect(createDynamoClient(local)).toBeInstanceOf(DynamoDBDocumentClient);
  });

  it('only treats failed conditions as conditional failures', () => {
    expect(isConditionalFailure(conditionalError())).toBe(true);
    expect(isConditionalFailure(cancelled('ConditionalCheckFailed'))).toBe(
      true,
    );
    expect(isConditionalFailure(cancelled('TransactionConflict'))).toBe(false);
    expect(
      isConditionalFailure(
        Object.assign(new Error('x'), { name: 'TransactionCanceledException' }),
      ),
    ).toBe(false);
    expect(isConditionalFailure(new Error('other'))).toBe(false);
    expect(isConditionalFailure('not an error')).toBe(false);
  });
});

describe('DynamoProductRepository', () => {
  const repo = new DynamoProductRepository(client, 'products');
  const item = { ...aProduct(), available: 10 };

  it('lists products sorted by name without the internal available attribute', async () => {
    ddb.on(ScanCommand).resolves({
      Items: [
        { ...item, id: 'b', name: 'B' },
        { ...item, id: 'a', name: 'A' },
      ],
    });
    const products = await repo.findAll();
    expect(products.map((p) => p.id)).toEqual(['a', 'b']);
    expect(products[0]).not.toHaveProperty('available');
  });

  it('handles empty scans and missing items', async () => {
    ddb.on(ScanCommand).resolves({});
    ddb.on(GetCommand).resolves({});
    expect(await repo.findAll()).toEqual([]);
    expect(await repo.findById('p-1')).toBeNull();
  });

  it('reserves stock with a conditional update on the available units', async () => {
    ddb.on(UpdateCommand).resolves({});
    expect(await repo.reserve('p-1', 2)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(ddb.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      Key: { id: 'p-1' },
      ConditionExpression: 'attribute_exists(id) AND available >= :q',
      ExpressionAttributeValues: { ':q': 2 },
    });
  });

  it('distinguishes out of stock from unknown products when the condition fails', async () => {
    ddb.on(UpdateCommand).rejects(conditionalError());
    ddb.on(GetCommand).resolvesOnce({ Item: item }).resolvesOnce({});
    expect(await repo.reserve('p-1', 20)).toMatchObject({
      ok: false,
      error: { type: 'OUT_OF_STOCK' },
    });
    expect(await repo.reserve('nope', 1)).toMatchObject({
      ok: false,
      error: { type: 'NOT_FOUND' },
    });
  });

  it('releases reserved units with a guarded update', async () => {
    ddb.on(UpdateCommand).resolves({});
    await repo.release('p-1', 2);
    expect(ddb.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      UpdateExpression:
        'SET reserved = reserved - :q, available = available + :q',
      ConditionExpression: 'reserved >= :q',
    });
  });

  it('rethrows unexpected errors', async () => {
    ddb.on(UpdateCommand).rejects(new Error('throttled'));
    await expect(repo.reserve('p-1', 1)).rejects.toThrow('throttled');
  });
});

describe('DynamoCustomerRepository', () => {
  it('upserts customers keeping the original creation date', async () => {
    ddb.on(UpdateCommand).resolves({});
    const customer = {
      email: 'ana@example.com',
      fullName: 'Ana',
      phone: '3001234567',
    };
    await new DynamoCustomerRepository(
      client,
      'customers',
      new FixedClock(),
    ).upsert(customer);
    expect(ddb.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      Key: { email: 'ana@example.com' },
      ExpressionAttributeValues: {
        ':name': 'Ana',
        ':phone': '3001234567',
        ':now': '2026-09-24T12:00:00.000Z',
      },
    });
  });
});

describe('DynamoTransactionRepository', () => {
  const repo = new DynamoTransactionRepository(client, 'transactions');

  it('creates transactions only once', async () => {
    ddb
      .on(PutCommand)
      .resolvesOnce({})
      .rejectsOnce(conditionalError())
      .rejectsOnce(new Error('boom'));
    expect(await repo.create(aTransaction())).toBe(true);
    expect(await repo.create(aTransaction())).toBe(false);
    await expect(repo.create(aTransaction())).rejects.toThrow('boom');
    expect(
      ddb.commandCalls(PutCommand)[0].args[0].input.ConditionExpression,
    ).toBe('attribute_not_exists(id)');
  });

  it('finds transactions and attaches the gateway id', async () => {
    ddb.on(GetCommand).resolvesOnce({ Item: aTransaction() }).resolvesOnce({});
    ddb
      .on(UpdateCommand)
      .resolves({ Attributes: aTransaction({ gatewayTransactionId: 'gw-1' }) });

    expect(await repo.findById('tx-1')).toMatchObject({ id: 'tx-1' });
    expect(await repo.findById('nope')).toBeNull();
    expect(await repo.attachGatewayId('tx-1', 'gw-1', 'now')).toMatchObject({
      gatewayTransactionId: 'gw-1',
    });
  });
});

describe('DynamoDeliveryRepository', () => {
  const repo = new DynamoDeliveryRepository(client, 'deliveries');

  it('queries the delivery by transaction through the GSI', async () => {
    ddb
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ id: 'd-1', transactionId: 'tx-1' }] })
      .resolvesOnce({});
    expect(await repo.findByTransactionId('tx-1')).toMatchObject({ id: 'd-1' });
    expect(await repo.findByTransactionId('tx-2')).toBeNull();
    expect(ddb.commandCalls(QueryCommand)[0].args[0].input.IndexName).toBe(
      'transactionId-index',
    );
  });
});

describe('DynamoSettlementRepository', () => {
  const repo = new DynamoSettlementRepository(client, tables);
  const delivery = { id: 'd-1', transactionId: 'tx-1' } as Delivery;

  it('approves in one transaction: status, stock and delivery', async () => {
    ddb.on(TransactWriteCommand).resolves({});
    await repo.settleApproved(aTransaction(), delivery);
    const items =
      ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
    expect(items).toHaveLength(3);
    expect(items[0].Update).toMatchObject({
      TableName: 'transactions',
      ConditionExpression: '#status = :pending',
    });
    expect(items[1].Update).toMatchObject({
      UpdateExpression: 'SET stock = stock - :q, reserved = reserved - :q',
    });
    expect(items[2].Put).toMatchObject({
      TableName: 'deliveries',
      Item: delivery,
    });
  });

  it('rejects in one transaction: status and released reservation', async () => {
    ddb.on(TransactWriteCommand).resolves({});
    await repo.settleRejected(aTransaction({ status: 'DECLINED' }));
    const items =
      ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
    expect(items).toHaveLength(2);
    expect(items[1].Update).toMatchObject({
      UpdateExpression:
        'SET reserved = reserved - :q, available = available + :q',
    });
  });

  it('ignores a second settlement and rethrows other failures', async () => {
    ddb
      .on(TransactWriteCommand)
      .rejectsOnce(cancelled('ConditionalCheckFailed'))
      .rejectsOnce(new Error('boom'));
    await expect(repo.settleRejected(aTransaction())).resolves.toBeUndefined();
    await expect(repo.settleRejected(aTransaction())).rejects.toThrow('boom');
  });
});
