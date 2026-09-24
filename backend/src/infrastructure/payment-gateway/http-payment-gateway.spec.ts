import {
  HttpPaymentGateway,
  integritySignature,
  toStatus,
} from './http-payment-gateway';

const config = {
  apiUrl: 'https://gateway.test/v1',
  publicKey: 'pub_test',
  privateKey: 'prv_test',
  integritySecret: 'integrity_test',
  timeoutMs: 1000,
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe('HttpPaymentGateway', () => {
  it('computes the integrity signature as sha256 of reference, amount, currency and secret', () => {
    expect(integritySignature('REF-1', 1500000, 'COP', 'secret')).toBe(
      '828b7f2a17bfebb761a1b619bc3990c963a75028cecaf1bbf160d763430c882d',
    );
    expect(integritySignature('REF-1', 1500000, 'COP', 'secret')).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(integritySignature('REF-1', 1500000, 'COP', 'secret')).not.toBe(
      integritySignature('REF-1', 1500001, 'COP', 'secret'),
    );
  });

  it('maps unknown statuses to ERROR', () => {
    expect(toStatus('APPROVED')).toBe('APPROVED');
    expect(toStatus('SOMETHING_ELSE')).toBe('ERROR');
  });

  it('reads the acceptance tokens from the merchant endpoint', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({
        data: {
          presigned_acceptance: {
            acceptance_token: 'acc',
            permalink: 'https://terms',
          },
          presigned_personal_data_auth: {
            acceptance_token: 'per',
            permalink: 'https://personal',
          },
        },
      }),
    );
    const result = await new HttpPaymentGateway(
      config,
      fetchFn,
    ).getAcceptanceTokens();

    expect(fetchFn).toHaveBeenCalledWith(
      'https://gateway.test/v1/merchants/pub_test',
      expect.any(Object),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        acceptanceToken: 'acc',
        personalDataAuthToken: 'per',
        termsUrl: 'https://terms',
        personalDataUrl: 'https://personal',
      },
    });
  });

  it('charges a card with the private key and a signed body', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { id: 'gw-1', status: 'PENDING' } }),
      );
    const result = await new HttpPaymentGateway(config, fetchFn).chargeCard({
      reference: 'TX-1',
      amountInCents: 1500000,
      currency: 'COP',
      customerEmail: 'ana@example.com',
      cardToken: 'tok_1',
      installments: 2,
      acceptanceToken: 'acc',
      personalDataAuthToken: 'per',
    });

    expect(result).toEqual({
      ok: true,
      value: { id: 'gw-1', status: 'PENDING' },
    });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gateway.test/v1/transactions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer prv_test',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      amount_in_cents: 1500000,
      currency: 'COP',
      customer_email: 'ana@example.com',
      reference: 'TX-1',
      signature: integritySignature('TX-1', 1500000, 'COP', 'integrity_test'),
      acceptance_token: 'acc',
      accept_personal_auth: 'per',
      payment_method: { type: 'CARD', token: 'tok_1', installments: 2 },
    });
  });

  it('reads a transaction status', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { id: 'gw/1', status: 'DECLINED' } }),
      );
    const result = await new HttpPaymentGateway(config, fetchFn).getTransaction(
      'gw/1',
    );

    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://gateway.test/v1/transactions/gw%2F1',
    );
    expect(result).toEqual({
      ok: true,
      value: { id: 'gw/1', status: 'DECLINED' },
    });
  });

  it('turns HTTP errors and network failures into gateway errors', async () => {
    const httpError = new HttpPaymentGateway(
      config,
      jest.fn().mockResolvedValue(jsonResponse({}, 422)),
    );
    const networkError = new HttpPaymentGateway(
      config,
      jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    );

    expect(await httpError.getTransaction('gw-1')).toEqual({
      ok: false,
      error: {
        type: 'PAYMENT_GATEWAY',
        message: 'Payment gateway responded with HTTP 422',
      },
    });
    expect(await networkError.getAcceptanceTokens()).toEqual({
      ok: false,
      error: {
        type: 'PAYMENT_GATEWAY',
        message: 'Payment gateway is unreachable',
      },
    });
    expect(
      await networkError.chargeCard({
        reference: 'TX-1',
        amountInCents: 1,
        currency: 'COP',
        customerEmail: 'a@b.co',
        cardToken: 't',
        installments: 1,
        acceptanceToken: 'a',
        personalDataAuthToken: 'p',
      }),
    ).toMatchObject({ ok: false });
  });
});
