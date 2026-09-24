import { Customer } from '../../domain/customer';
import { Delivery } from '../../domain/delivery';
import { Product } from '../../domain/product';
import { DomainError } from '../../domain/shared/errors';
import { Result } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction';

export const PRODUCT_REPOSITORY = Symbol('ProductRepository');
export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');
export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');
export const DELIVERY_REPOSITORY = Symbol('DeliveryRepository');
export const SETTLEMENT_REPOSITORY = Symbol('SettlementRepository');

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  /** Reserves units only if enough stock is available (atomic conditional write). */
  reserve(id: string, quantity: number): Promise<Result<void, DomainError>>;
  /** Gives back units reserved by a transaction that could not be created. */
  release(id: string, quantity: number): Promise<void>;
}

export interface CustomerRepository {
  upsert(customer: Customer): Promise<Customer>;
}

export interface TransactionRepository {
  /** Stores a new transaction; returns false when the id already exists. */
  create(transaction: Transaction): Promise<boolean>;
  findById(id: string): Promise<Transaction | null>;
  /** Stores the gateway id while the transaction is still PENDING. */
  attachGatewayId(
    id: string,
    gatewayTransactionId: string,
    updatedAt: string,
  ): Promise<Transaction>;
}

export interface DeliveryRepository {
  findByTransactionId(transactionId: string): Promise<Delivery | null>;
}

/**
 * Applies the final outcome of a payment atomically and only once:
 * the transaction must still be PENDING, otherwise the call is a no-op.
 */
export interface SettlementRepository {
  settleApproved(transaction: Transaction, delivery: Delivery): Promise<void>;
  settleRejected(transaction: Transaction): Promise<void>;
}
