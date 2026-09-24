import { DomainError } from '../../domain/shared/errors';
import { toHttpException } from './result-to-http';

describe('toHttpException', () => {
  it.each([
    [{ type: 'VALIDATION', message: 'bad', details: ['x'] }, 400],
    [{ type: 'NOT_FOUND', message: 'missing' }, 404],
    [{ type: 'OUT_OF_STOCK', message: 'gone' }, 409],
    [{ type: 'CONFLICT', message: 'dup' }, 409],
    [{ type: 'PAYMENT_GATEWAY', message: 'down' }, 502],
  ] as [DomainError, number][])('maps %o to HTTP %i', (error, status) => {
    const exception = toHttpException(error);
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toMatchObject({
      error: error.type,
      message: error.message,
    });
  });

  it('omits details when a validation error has none', () => {
    expect(
      toHttpException({ type: 'VALIDATION', message: 'bad' }).getResponse(),
    ).not.toHaveProperty('details');
  });
});
