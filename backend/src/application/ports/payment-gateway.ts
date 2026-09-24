import { DomainError } from '../../domain/shared/errors';
import { Result } from '../../domain/shared/result';
import { TransactionStatus } from '../../domain/transaction';

export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

export interface AcceptanceTokens {
  readonly acceptanceToken: string;
  readonly personalDataAuthToken: string;
  readonly termsUrl: string;
  readonly personalDataUrl: string;
}

export interface CardChargeRequest {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly customerEmail: string;
  readonly cardToken: string;
  readonly installments: number;
  readonly acceptanceToken: string;
  readonly personalDataAuthToken: string;
}

export interface GatewayTransaction {
  readonly id: string;
  readonly status: TransactionStatus;
}

export interface PaymentGateway {
  getAcceptanceTokens(): Promise<Result<AcceptanceTokens, DomainError>>;
  chargeCard(
    request: CardChargeRequest,
  ): Promise<Result<GatewayTransaction, DomainError>>;
  getTransaction(
    gatewayTransactionId: string,
  ): Promise<Result<GatewayTransaction, DomainError>>;
}
