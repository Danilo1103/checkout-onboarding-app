import { Transaction } from '../../domain/transaction';

/** Public view of a transaction: shipping details and customer data are not echoed back. */
export const presentTransaction = (transaction: Transaction) => ({
  id: transaction.id,
  reference: transaction.reference,
  status: transaction.status,
  productId: transaction.productId,
  quantity: transaction.quantity,
  currency: transaction.currency,
  amounts: transaction.amounts,
  card: { brand: transaction.cardBrand, last4: transaction.cardLast4 },
  createdAt: transaction.createdAt,
  updatedAt: transaction.updatedAt,
});
