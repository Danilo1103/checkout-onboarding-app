import type { CardBrand } from '../lib/card';
import type { CustomerInput, ShippingInput } from '../lib/delivery';

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  priceInCents: number;
  availableUnits: number;
}

export interface Amounts {
  productInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  totalInCents: number;
}

export interface Quote {
  productId: string;
  quantity: number;
  currency: string;
  amounts: Amounts;
}

export interface LegalLinks {
  termsUrl: string;
  personalDataUrl: string;
}

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

export interface Transaction {
  id: string;
  reference: string;
  status: TransactionStatus;
  productId: string;
  quantity: number;
  currency: string;
  amounts: Amounts;
  card: { brand: CardBrand; last4: string };
  createdAt: string;
  updatedAt: string;
}

export interface CardSummary {
  token: string;
  brand: CardBrand;
  last4: string;
}

export interface CreateTransactionRequest {
  idempotencyKey: string;
  productId: string;
  quantity: number;
  customer: CustomerInput;
  shipping: ShippingInput;
  card: { token: string; brand: CardBrand; last4: string; installments: number };
  acceptedTerms: boolean;
  acceptedPersonalData: boolean;
}
