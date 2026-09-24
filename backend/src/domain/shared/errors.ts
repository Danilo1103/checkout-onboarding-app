export type DomainError =
  | {
      readonly type: 'VALIDATION';
      readonly message: string;
      readonly details?: string[];
    }
  | { readonly type: 'NOT_FOUND'; readonly message: string }
  | { readonly type: 'OUT_OF_STOCK'; readonly message: string }
  | { readonly type: 'CONFLICT'; readonly message: string }
  | { readonly type: 'PAYMENT_GATEWAY'; readonly message: string };

export const validationError = (
  message: string,
  details?: string[],
): DomainError => ({
  type: 'VALIDATION',
  message,
  details,
});
export const notFound = (message: string): DomainError => ({
  type: 'NOT_FOUND',
  message,
});
export const outOfStock = (message: string): DomainError => ({
  type: 'OUT_OF_STOCK',
  message,
});
export const conflict = (message: string): DomainError => ({
  type: 'CONFLICT',
  message,
});
export const paymentGatewayError = (message: string): DomainError => ({
  type: 'PAYMENT_GATEWAY',
  message,
});
