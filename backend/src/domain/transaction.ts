import { Amounts } from './pricing';
import { ShippingInfo } from './delivery';

export type TransactionStatus =
  'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

export const FINAL_STATUSES: readonly TransactionStatus[] = [
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
];

export const isFinal = (status: TransactionStatus): boolean =>
  FINAL_STATUSES.includes(status);

export type CardBrand = 'VISA' | 'MASTERCARD' | 'UNKNOWN';

export interface Transaction {
  readonly id: string;
  readonly reference: string;
  readonly productId: string;
  readonly quantity: number;
  readonly customerEmail: string;
  readonly amounts: Amounts;
  readonly currency: string;
  readonly status: TransactionStatus;
  readonly gatewayTransactionId?: string;
  readonly cardBrand: CardBrand;
  readonly cardLast4: string;
  readonly shipping: ShippingInfo;
  readonly createdAt: string;
  readonly updatedAt: string;
}
