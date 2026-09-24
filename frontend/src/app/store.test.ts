import { ApiError } from '../api/http';
import {
  cancelCheckout,
  editDetails,
  finishCheckout,
  initialCheckoutState,
  loadSummary,
  MAX_NOT_FOUND,
  MAX_POLLS,
  pay,
  pollTransaction,
  setAcceptedTerms,
  startCheckout,
  submitDetails,
} from '../features/checkout/checkoutSlice';
import { fetchProducts } from '../features/products/productsSlice';
import { aTransaction, fakeServices, MemoryStorage, validCard, validCustomer, validShipping } from '../test/fakes';
import { loadCheckout, saveCheckout, STORAGE_KEY } from './persistence';

const KEY = '0b6f4a1e-6a7c-4d2b-9a55-3f0f7c2d9e11';
import { createAppStore } from './store';

const setup = (services = fakeServices(), storage = new MemoryStorage()) => ({
  store: createAppStore(services, undefined, storage),
  services,
  storage,
});

const toSummary = async (store: ReturnType<typeof setup>['store']) => {
  store.dispatch(startCheckout({ productId: 'prod-headphones', quantity: 2 }));
  await store.dispatch(submitDetails({ card: validCard, customer: validCustomer, shipping: validShipping }));
};

describe('products', () => {
  it('loads products', async () => {
    const { store } = setup();
    const pending = store.dispatch(fetchProducts());
    expect(store.getState().products.status).toBe('loading');
    await pending;
    expect(store.getState().products).toMatchObject({ status: 'succeeded', items: [{ id: 'prod-headphones' }] });
  });

  it('keeps the error message when loading fails', async () => {
    const { store } = setup(fakeServices({ getProducts: jest.fn().mockRejectedValue(new Error('offline')) }));
    await store.dispatch(fetchProducts());
    expect(store.getState().products).toMatchObject({ status: 'failed', error: 'offline' });
  });
});

describe('checkout flow', () => {
  it('goes from product to details to summary with a tokenized card', async () => {
    const { store, services } = setup();
    await toSummary(store);

    expect(services.tokenizeCard).toHaveBeenCalledWith(validCard);
    expect(store.getState().checkout).toMatchObject({
      step: 'summary',
      quantity: 2,
      card: { brand: 'VISA', last4: '4242' },
      cardToken: 'tok_1',
      customer: validCustomer,
    });
  });

  it('shows tokenization errors and stays on the details step', async () => {
    const services = fakeServices();
    services.tokenizeCard = jest.fn().mockRejectedValue(new ApiError('Tarjeta inválida', 422));
    const { store } = setup(services);
    await toSummary(store);
    expect(store.getState().checkout).toMatchObject({ step: 'details', status: 'failed', error: 'Tarjeta inválida' });
  });

  it('loads the server quote and legal links for the summary', async () => {
    const { store, services } = setup();
    await toSummary(store);
    await store.dispatch(loadSummary());

    expect(services.api.getQuote).toHaveBeenCalledWith('prod-headphones', 2);
    expect(store.getState().checkout.quote?.amounts.totalInCents).toBe(36_490_000);
    expect(store.getState().checkout.legal?.termsUrl).toBe('https://terms.test');
  });

  it('reports quote errors', async () => {
    const { store } = setup(fakeServices({ getQuote: jest.fn().mockRejectedValue(new Error('Only 1 unit available')) }));
    await toSummary(store);
    await store.dispatch(loadSummary());
    expect(store.getState().checkout.error).toBe('Only 1 unit available');
  });

  it('pays with the token, then forgets it', async () => {
    const { store, services } = setup();
    await toSummary(store);
    store.dispatch(setAcceptedTerms(true));
    await store.dispatch(pay());

    expect(services.api.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-headphones',
        quantity: 2,
        card: { token: 'tok_1', brand: 'VISA', last4: '4242', installments: 1 },
        acceptedTerms: true,
        acceptedPersonalData: true,
      }),
    );
    expect(store.getState().checkout).toMatchObject({ step: 'status', cardToken: null, transaction: { id: 'tx-1' } });
  });

  it('sends an idempotency key, persists it before the request and reuses it on retries', async () => {
    const createTransaction = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Sin conexión', 0))
      .mockResolvedValueOnce(aTransaction({ id: KEY }));
    const { store, storage, services } = setup(fakeServices({ createTransaction }));
    await toSummary(store);

    await store.dispatch(pay());
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).paymentId).toBe(KEY);
    expect(store.getState().checkout).toMatchObject({ step: 'summary', paymentId: KEY, error: 'Sin conexión' });

    await store.dispatch(pay());
    expect(services.newId).toHaveBeenCalledTimes(1);
    expect(createTransaction.mock.calls.map(([body]) => body.idempotencyKey)).toEqual([KEY, KEY]);
    expect(store.getState().checkout).toMatchObject({ step: 'status', paymentId: KEY });
  });

  it('forgets the key after a definitive rejection, since no payment was created', async () => {
    const { store } = setup(
      fakeServices({ createTransaction: jest.fn().mockRejectedValue(new ApiError('Sin stock', 409)) }),
    );
    await toSummary(store);
    await store.dispatch(pay());
    expect(store.getState().checkout.paymentId).toBeNull();
  });

  it('keeps the customer on the summary when payment creation fails', async () => {
    const { store } = setup(
      fakeServices({ createTransaction: jest.fn().mockRejectedValue(new ApiError('Sin stock', 409, 'OUT_OF_STOCK')) }),
    );
    await toSummary(store);
    await store.dispatch(pay());
    expect(store.getState().checkout).toMatchObject({ step: 'summary', status: 'failed', error: 'Sin stock' });
  });

  it('polls until the transaction reaches a final status', async () => {
    const getTransaction = jest
      .fn()
      .mockResolvedValueOnce(aTransaction())
      .mockResolvedValueOnce(aTransaction())
      .mockResolvedValueOnce(aTransaction({ status: 'DECLINED' }));
    const { store, services } = setup(fakeServices({ getTransaction }));
    await store.dispatch(pollTransaction('tx-1'));

    expect(getTransaction).toHaveBeenCalledTimes(3);
    expect(services.wait).toHaveBeenCalledTimes(2);
    expect(store.getState().checkout.transaction?.status).toBe('DECLINED');
  });

  it('tolerates a few 404s while the payment is still being created, then gives up', async () => {
    const getTransaction = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Not found', 404))
      .mockResolvedValueOnce(aTransaction({ status: 'APPROVED' }));
    const { store } = setup(fakeServices({ getTransaction }));
    await store.dispatch(pollTransaction('tx-1'));
    expect(store.getState().checkout.transaction?.status).toBe('APPROVED');

    getTransaction.mockReset().mockRejectedValue(new ApiError('Not found', 404));
    await store.dispatch(pollTransaction('tx-1'));
    expect(getTransaction).toHaveBeenCalledTimes(MAX_NOT_FOUND);
    expect(store.getState().checkout.error).toContain('no se realizó ningún cobro');
  });

  it('stops polling after the maximum attempts and reports errors', async () => {
    const getTransaction = jest.fn().mockResolvedValue(aTransaction());
    const { store } = setup(fakeServices({ getTransaction }));
    await store.dispatch(pollTransaction('tx-1'));
    expect(getTransaction).toHaveBeenCalledTimes(MAX_POLLS);

    getTransaction.mockRejectedValueOnce(new Error('offline'));
    await store.dispatch(pollTransaction('tx-1'));
    expect(store.getState().checkout.error).toBe('offline');
  });

  it('can go back to edit, cancel and finish keeping contact data', async () => {
    const { store } = setup();
    await toSummary(store);
    store.dispatch(editDetails());
    expect(store.getState().checkout.step).toBe('details');

    store.dispatch(cancelCheckout());
    expect(store.getState().checkout).toMatchObject({ step: 'product', cardToken: null, card: null });

    await toSummary(store);
    store.dispatch(finishCheckout());
    expect(store.getState().checkout).toEqual({ ...initialCheckoutState, customer: validCustomer, shipping: validShipping });
  });

  it('uses a generic message for non Error rejections', async () => {
    const services = fakeServices();
    services.tokenizeCard = jest.fn().mockRejectedValue('boom');
    const { store } = setup(services);
    await toSummary(store);
    expect(store.getState().checkout.error).toBe('Ocurrió un error inesperado');
  });
});

describe('persistence', () => {
  it('persists progress without the card token', async () => {
    const { store, storage } = setup();
    await toSummary(store);
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);

    expect(saved).toMatchObject({ step: 'summary', card: { last4: '4242' }, customer: validCustomer });
    expect(JSON.stringify(saved)).not.toContain('tok_1');
    expect(saved).not.toHaveProperty('cardToken');
  });

  it('sends the customer back to re-enter the card after a refresh on the summary', async () => {
    const { store, storage } = setup();
    await toSummary(store);
    const restored = createAppStore(fakeServices(), undefined, storage).getState().checkout;

    expect(restored).toMatchObject({ step: 'details', card: null, cardToken: null, shipping: validShipping });
    expect(restored.notice).toContain('vuelve a ingresar');
  });

  it('goes to the result, not back to the form, when reloading while the payment is being sent', () => {
    const storage = new MemoryStorage();
    saveCheckout({ ...initialCheckoutState, step: 'summary', paymentId: KEY }, storage);
    expect(loadCheckout(storage)).toMatchObject({ step: 'status', paymentId: KEY, transaction: null });
  });

  it('resumes a payment in progress after a refresh', () => {
    const storage = new MemoryStorage();
    saveCheckout({ ...initialCheckoutState, step: 'status', transaction: aTransaction() }, storage);
    expect(loadCheckout(storage)).toMatchObject({ step: 'status', transaction: { id: 'tx-1', status: 'PENDING' } });
  });

  it('falls back to a clean state for empty, broken or inconsistent storage', () => {
    const storage = new MemoryStorage();
    expect(loadCheckout(storage)).toEqual(initialCheckoutState);
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadCheckout(storage)).toEqual(initialCheckoutState);
    storage.setItem(STORAGE_KEY, JSON.stringify({ step: 'status', transaction: null }));
    expect(loadCheckout(storage).step).toBe('product');
  });

  it('ignores storage failures', () => {
    const broken = { setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    expect(() => saveCheckout(initialCheckoutState, broken)).not.toThrow();
  });

  it('uses window.localStorage by default', () => {
    saveCheckout({ ...initialCheckoutState, quantity: 3 });
    expect(loadCheckout().quantity).toBe(3);
    window.localStorage.clear();
    expect(createAppStore(fakeServices()).getState().checkout.quantity).toBe(1);
  });
});
