import { tokenizeCard } from './cardTokenizer';
import { checkoutApi } from './checkoutApi';
import { ApiError, requestJson } from './http';

const respond = (body: unknown, status = 200) =>
  jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

const card = { number: '4242 4242 4242 4242', holder: ' Ana Gomez ', expiry: '12/29', cvc: '123' };

describe('requestJson', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the parsed body and sends JSON headers', async () => {
    globalThis.fetch = respond({ ok: 1 });
    await expect(requestJson('http://x/y', { headers: { A: 'b' } })).resolves.toEqual({ ok: 1 });
    expect((globalThis.fetch as jest.Mock).mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json', A: 'b' });
  });

  it('turns API errors into ApiError with message and code', async () => {
    globalThis.fetch = respond({ error: 'OUT_OF_STOCK', message: 'Only 1 unit' }, 409);
    await expect(requestJson('http://x')).rejects.toMatchObject({ status: 409, code: 'OUT_OF_STOCK', message: 'Only 1 unit' });

    globalThis.fetch = respond({ message: ['a', 'b'] }, 400);
    await expect(requestJson('http://x')).rejects.toMatchObject({ message: 'a, b' });

    globalThis.fetch = respond({ error: { type: 'INPUT_VALIDATION_ERROR' } }, 422);
    await expect(requestJson('http://x')).rejects.toMatchObject({ code: 'INPUT_VALIDATION_ERROR', message: 'Ocurrió un error inesperado' });
  });

  it('handles bodies that are not JSON and network failures', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => Promise.reject(new Error('html')) });
    await expect(requestJson('http://x')).rejects.toMatchObject({ status: 500 });

    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(requestJson('http://x')).rejects.toEqual(expect.any(ApiError));
  });
});

describe('checkoutApi', () => {
  it('calls the backend endpoints', async () => {
    globalThis.fetch = respond({});
    await checkoutApi.getProducts();
    await checkoutApi.getQuote('p 1', 2);
    await checkoutApi.getLegalLinks();
    await checkoutApi.getTransaction('tx-1');
    await checkoutApi.createTransaction({ productId: 'p' } as never);
    const urls = (globalThis.fetch as jest.Mock).mock.calls.map((call) => call[0]);
    expect(urls).toEqual([
      'http://api.test/products',
      'http://api.test/checkout/quote?productId=p%201&quantity=2',
      'http://api.test/checkout/acceptance',
      'http://api.test/transactions/tx-1',
      'http://api.test/transactions',
    ]);
    expect((globalThis.fetch as jest.Mock).mock.calls[4][1]).toMatchObject({ method: 'POST', body: '{"productId":"p"}' });
  });
});

describe('tokenizeCard', () => {
  it('sends the card to the gateway with the public key and returns only the token summary', async () => {
    globalThis.fetch = respond({ data: { id: 'tok_1', last_four: '4242' } });
    await expect(tokenizeCard(card)).resolves.toEqual({ token: 'tok_1', brand: 'VISA', last4: '4242' });

    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://gateway.test/v1/tokens/cards');
    expect(init.headers.Authorization).toBe('Bearer pub_test');
    expect(JSON.parse(init.body)).toEqual({
      number: '4242424242424242',
      cvc: '123',
      exp_month: '12',
      exp_year: '29',
      card_holder: 'Ana Gomez',
    });
  });

  it('rejects malformed expiry dates and hides gateway error details', async () => {
    await expect(tokenizeCard({ ...card, expiry: '1229' })).rejects.toMatchObject({ status: 400 });
    globalThis.fetch = respond({ error: { type: 'INPUT_VALIDATION_ERROR' } }, 422);
    await expect(tokenizeCard(card)).rejects.toMatchObject({ message: 'No pudimos validar tu tarjeta. Revisa los datos.' });
  });

  it('keeps network errors as they are', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline'));
    await expect(tokenizeCard(card)).rejects.toMatchObject({ status: 0 });
  });
});
