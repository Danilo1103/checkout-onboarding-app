import {
  aCustomer,
  FakeGateway,
  InMemoryCustomers,
  InMemoryDb,
  InMemoryDeliveries,
  InMemoryProducts,
} from '../../test-utils/in-memory';
import { GetAcceptanceTokens } from './get-acceptance-tokens';
import { GetCheckoutQuote } from './get-checkout-quote';
import { GetDelivery } from './get-delivery';
import { GetProduct } from './get-product';
import { ListProducts } from './list-products';
import { UpsertCustomer } from './upsert-customer';

const fees = { baseFeeInCents: 500_000, deliveryFeeInCents: 1_000_000 };

describe('catalog and checkout queries', () => {
  let db: InMemoryDb;
  let products: InMemoryProducts;

  beforeEach(() => {
    db = new InMemoryDb();
    products = new InMemoryProducts(db);
  });

  it('lists products with their available units', async () => {
    await products.reserve('p-1', 3);
    const [view] = await new ListProducts(products).execute();
    expect(view).toMatchObject({ id: 'p-1', availableUnits: 7 });
    expect(view).not.toHaveProperty('reserved');
  });

  it('gets a product or reports it as not found', async () => {
    const getProduct = new GetProduct(products);
    expect(await getProduct.execute('p-1')).toMatchObject({
      ok: true,
      value: { id: 'p-1' },
    });
    expect(await getProduct.execute('nope')).toMatchObject({
      ok: false,
      error: { type: 'NOT_FOUND' },
    });
  });

  describe('quote', () => {
    const quote = () => new GetCheckoutQuote(products, fees);

    it('returns the amounts computed on the server', async () => {
      const result = await quote().execute('p-1', 2);
      expect(result).toMatchObject({
        ok: true,
        value: {
          currency: 'COP',
          amounts: { productInCents: 50_000_000, totalInCents: 51_500_000 },
        },
      });
    });

    it('rejects invalid quantities, unknown products and missing stock', async () => {
      expect(await quote().execute('p-1', 0)).toMatchObject({
        ok: false,
        error: { type: 'VALIDATION' },
      });
      expect(await quote().execute('nope', 1)).toMatchObject({
        ok: false,
        error: { type: 'NOT_FOUND' },
      });
      await products.reserve('p-1', 9);
      expect(await quote().execute('p-1', 2)).toMatchObject({
        ok: false,
        error: { type: 'OUT_OF_STOCK' },
      });
    });
  });

  it('returns the acceptance tokens from the gateway', async () => {
    const result = await new GetAcceptanceTokens(new FakeGateway()).execute();
    expect(result).toMatchObject({
      ok: true,
      value: { acceptanceToken: 'acc-token' },
    });
  });

  it('normalizes and stores valid customers, rejecting invalid ones', async () => {
    const upsert = new UpsertCustomer(new InMemoryCustomers(db));
    const saved = await upsert.execute(
      aCustomer({ email: ' Ana@Example.com ', fullName: ' Ana ' }),
    );
    expect(saved).toMatchObject({
      ok: true,
      value: { email: 'ana@example.com', fullName: 'Ana' },
    });
    expect(db.customers.has('ana@example.com')).toBe(true);

    const invalid = await upsert.execute(
      aCustomer({ email: 'bad', fullName: '', phone: '1' }),
    );
    expect(invalid).toMatchObject({ ok: false, error: { type: 'VALIDATION' } });
    if (!invalid.ok && invalid.error.type === 'VALIDATION')
      expect(invalid.error.details).toHaveLength(3);
  });

  it('gets the delivery of a transaction or reports it as not found', async () => {
    const getDelivery = new GetDelivery(new InMemoryDeliveries(db));
    expect(await getDelivery.execute('tx-1')).toMatchObject({
      ok: false,
      error: { type: 'NOT_FOUND' },
    });
    db.deliveries.set('d-1', { transactionId: 'tx-1' } as never);
    expect(await getDelivery.execute('tx-1')).toMatchObject({
      ok: true,
      value: { transactionId: 'tx-1' },
    });
  });
});

describe('customer validation with missing fields', () => {
  it('treats missing values as empty', async () => {
    const upsert = new UpsertCustomer(new InMemoryCustomers(new InMemoryDb()));
    const result = await upsert.execute({} as never);
    expect(result).toMatchObject({ ok: false, error: { type: 'VALIDATION' } });
  });
});
