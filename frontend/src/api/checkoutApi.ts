import { env } from '../env';
import { requestJson } from './http';
import type { CreateTransactionRequest, LegalLinks, Product, Quote, Transaction } from './types';

export const checkoutApi = {
  getProducts: () => requestJson<Product[]>(`${env.apiUrl}/products`),
  getQuote: (productId: string, quantity: number) =>
    requestJson<Quote>(
      `${env.apiUrl}/checkout/quote?productId=${encodeURIComponent(productId)}&quantity=${quantity}`,
    ),
  getLegalLinks: () => requestJson<LegalLinks>(`${env.apiUrl}/checkout/acceptance`),
  createTransaction: (body: CreateTransactionRequest) =>
    requestJson<Transaction>(`${env.apiUrl}/transactions`, { method: 'POST', body: JSON.stringify(body) }),
  getTransaction: (id: string) => requestJson<Transaction>(`${env.apiUrl}/transactions/${encodeURIComponent(id)}`),
};

export type CheckoutApi = typeof checkoutApi;
