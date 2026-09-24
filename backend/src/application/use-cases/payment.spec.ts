import { paymentGatewayError } from '../../domain/shared/errors';
import { err, ok } from '../../domain/shared/result';
import {
  aCustomer,
  aShipping,
  FakeGateway,
  FixedClock,
  InMemoryCustomers,
  InMemoryDb,
  InMemoryProducts,
  InMemorySettlements,
  InMemoryTransactions,
  SequentialIds,
} from '../../test-utils/in-memory';
import {
  CreateTransaction,
  CreateTransactionInput,
} from './create-transaction';
import { GetCheckoutQuote } from './get-checkout-quote';
import { SettleTransaction } from './settle-transaction';
import { SyncTransaction } from './sync-transaction';
import { UpsertCustomer } from './upsert-customer';

const fees = { baseFeeInCents: 500_000, deliveryFeeInCents: 1_000_000 };

const anInput = (
  overrides: Partial<CreateTransactionInput> = {},
): CreateTransactionInput => ({
  productId: 'p-1',
  quantity: 1,
  customer: aCustomer(),
  shipping: aShipping(),
  card: {
    token: 'tok_test_123',
    brand: 'VISA',
    last4: '4242',
    installments: 1,
  },
  acceptanceToken: 'acc-token',
  personalDataAuthToken: 'personal-token',
  ...overrides,
});

describe('payment flow', () => {
  let db: InMemoryDb;
  let gateway: FakeGateway;
  let createTransaction: CreateTransaction;
  let syncTransaction: SyncTransaction;

  beforeEach(() => {
    db = new InMemoryDb();
    gateway = new FakeGateway();
    const ids = new SequentialIds();
    const clock = new FixedClock();
    const products = new InMemoryProducts(db);
    const transactions = new InMemoryTransactions(db);
    const settle = new SettleTransaction(
      new InMemorySettlements(db),
      ids,
      clock,
    );
    createTransaction = new CreateTransaction(
      new GetCheckoutQuote(products, fees),
      new UpsertCustomer(new InMemoryCustomers(db)),
      products,
      transactions,
      gateway,
      settle,
      ids,
      clock,
    );
    syncTransaction = new SyncTransaction(transactions, gateway, settle);
  });

  const product = () => db.products.get('p-1')!;

  describe('create', () => {
    it('reserves stock, stores a PENDING transaction and charges the total amount', async () => {
      const result = await createTransaction.execute(anInput({ quantity: 2 }));

      expect(result).toMatchObject({
        ok: true,
        value: {
          status: 'PENDING',
          gatewayTransactionId: 'gw-1',
          reference: 'TX-id-1',
        },
      });
      expect(product()).toMatchObject({ stock: 10, reserved: 2 });
      expect(gateway.charges[0]).toMatchObject({
        reference: 'TX-id-1',
        amountInCents: 51_500_000,
        currency: 'COP',
        cardToken: 'tok_test_123',
        customerEmail: 'ana@example.com',
      });
    });

    it('settles immediately when the gateway already returns a final status', async () => {
      gateway.chargeResult = ok({ id: 'gw-9', status: 'APPROVED' });
      const result = await createTransaction.execute(anInput());

      expect(result).toMatchObject({ ok: true, value: { status: 'APPROVED' } });
      expect(product()).toMatchObject({ stock: 9, reserved: 0 });
      expect(db.deliveries.size).toBe(1);
    });

    it('marks the transaction as ERROR and releases stock when the charge fails', async () => {
      gateway.chargeResult = err(paymentGatewayError('Gateway unavailable'));
      const result = await createTransaction.execute(anInput());

      expect(result).toMatchObject({ ok: true, value: { status: 'ERROR' } });
      expect(product()).toMatchObject({ stock: 10, reserved: 0 });
      expect(db.deliveries.size).toBe(0);
    });

    it('rejects invalid requests with every validation error', async () => {
      const result = await createTransaction.execute(
        anInput({
          shipping: aShipping({ city: '' }),
          card: { token: ' ', brand: 'VISA', last4: '42', installments: 0 },
          acceptanceToken: '',
          personalDataAuthToken: '',
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === 'VALIDATION') {
        expect(result.error.details).toEqual([
          'shipping.city is required',
          'card.last4 must contain 4 digits',
          'card.token is required',
          'card.installments must be an integer between 1 and 36',
          'acceptanceToken is required',
          'personalDataAuthToken is required',
        ]);
      }
      expect(gateway.charges).toHaveLength(0);
    });

    it('stops before charging when the customer is invalid or stock is missing', async () => {
      expect(
        await createTransaction.execute(
          anInput({ customer: aCustomer({ email: 'bad' }) }),
        ),
      ).toMatchObject({
        ok: false,
        error: { type: 'VALIDATION' },
      });
      expect(
        await createTransaction.execute(anInput({ quantity: 6 })),
      ).toMatchObject({
        ok: false,
        error: { type: 'VALIDATION' },
      });
      db.products.set('p-1', { ...product(), stock: 1, reserved: 1 });
      expect(await createTransaction.execute(anInput())).toMatchObject({
        ok: false,
        error: { type: 'OUT_OF_STOCK' },
      });
      expect(gateway.charges).toHaveLength(0);
      expect(db.transactions.size).toBe(0);
    });

    it('never oversells when the reservation fails after the quote', async () => {
      const products = new InMemoryProducts(db);
      jest
        .spyOn(products, 'reserve')
        .mockResolvedValueOnce(err({ type: 'OUT_OF_STOCK', message: 'gone' }));
      const racing = new CreateTransaction(
        new GetCheckoutQuote(products, fees),
        new UpsertCustomer(new InMemoryCustomers(db)),
        products,
        new InMemoryTransactions(db),
        gateway,
        new SettleTransaction(
          new InMemorySettlements(db),
          new SequentialIds(),
          new FixedClock(),
        ),
        new SequentialIds(),
        new FixedClock(),
      );
      expect(await racing.execute(anInput())).toMatchObject({
        ok: false,
        error: { type: 'OUT_OF_STOCK' },
      });
      expect(gateway.charges).toHaveLength(0);
    });
  });

  describe('sync', () => {
    const createPending = async () => {
      const created = await createTransaction.execute(anInput());
      if (!created.ok) throw new Error('setup failed');
      return created.value;
    };

    it('approves: consumes the reserved stock and assigns the delivery', async () => {
      const pending = await createPending();
      const result = await syncTransaction.execute(pending.id);

      expect(result).toMatchObject({ ok: true, value: { status: 'APPROVED' } });
      expect(product()).toMatchObject({ stock: 9, reserved: 0 });
      expect([...db.deliveries.values()][0]).toMatchObject({
        transactionId: pending.id,
        status: 'ASSIGNED',
        city: 'Medellin',
      });
    });

    it('declines: releases the reservation without creating a delivery', async () => {
      const pending = await createPending();
      gateway.statusResult = ok({ id: 'gw-1', status: 'DECLINED' });

      expect(await syncTransaction.execute(pending.id)).toMatchObject({
        ok: true,
        value: { status: 'DECLINED' },
      });
      expect(product()).toMatchObject({ stock: 10, reserved: 0 });
      expect(db.deliveries.size).toBe(0);
    });

    it('is idempotent: syncing a settled transaction does not touch stock again', async () => {
      const pending = await createPending();
      await syncTransaction.execute(pending.id);
      gateway.statusResult = ok({ id: 'gw-1', status: 'DECLINED' });
      const second = await syncTransaction.execute(pending.id);

      expect(second).toMatchObject({ ok: true, value: { status: 'APPROVED' } });
      expect(product()).toMatchObject({ stock: 9, reserved: 0 });
    });

    it('keeps the transaction PENDING while the gateway is pending or failing', async () => {
      const pending = await createPending();
      gateway.statusResult = ok({ id: 'gw-1', status: 'PENDING' });
      expect(await syncTransaction.execute(pending.id)).toMatchObject({
        ok: true,
        value: { status: 'PENDING' },
      });

      gateway.statusResult = err(paymentGatewayError('timeout'));
      expect(await syncTransaction.execute(pending.id)).toMatchObject({
        ok: true,
        value: { status: 'PENDING' },
      });
      expect(product()).toMatchObject({ reserved: 1 });
    });

    it('does not call the gateway for transactions without a gateway id', async () => {
      const pending = await createPending();
      db.transactions.set(pending.id, {
        ...pending,
        gatewayTransactionId: undefined,
      });
      const spy = jest.spyOn(gateway, 'getTransaction');

      expect(await syncTransaction.execute(pending.id)).toMatchObject({
        ok: true,
        value: { status: 'PENDING' },
      });
      expect(spy).not.toHaveBeenCalled();
    });

    it('reports unknown transactions as not found', async () => {
      expect(await syncTransaction.execute('nope')).toMatchObject({
        ok: false,
        error: { type: 'NOT_FOUND' },
      });
    });
  });
});
