import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainError } from '../../domain/shared/errors';
import { Result } from '../../domain/shared/result';

const STATUS_BY_ERROR: Record<DomainError['type'], HttpStatus> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  OUT_OF_STOCK: HttpStatus.CONFLICT,
  CONFLICT: HttpStatus.CONFLICT,
  PAYMENT_GATEWAY: HttpStatus.BAD_GATEWAY,
};

export const toHttpException = (error: DomainError): HttpException =>
  new HttpException(
    {
      statusCode: STATUS_BY_ERROR[error.type],
      error: error.type,
      message: error.message,
      ...(error.type === 'VALIDATION' && error.details
        ? { details: error.details }
        : {}),
    },
    STATUS_BY_ERROR[error.type],
  );

/** Returns the value of a successful result or throws the matching HTTP error. */
export const unwrap = async <T>(
  result: PromiseLike<Result<T, DomainError>>,
): Promise<T> => {
  const resolved = await result;
  if (resolved.ok) return resolved.value;
  throw toHttpException(resolved.error);
};
