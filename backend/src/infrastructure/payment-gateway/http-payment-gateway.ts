import { createHash } from 'node:crypto';
import {
  AcceptanceTokens,
  CardChargeRequest,
  GatewayTransaction,
  PaymentGateway,
} from '../../application/ports/payment-gateway';
import { DomainError, paymentGatewayError } from '../../domain/shared/errors';
import { err, ok, Result } from '../../domain/shared/result';
import { TransactionStatus } from '../../domain/transaction';
import { AppConfig } from '../config/app-config';

type FetchFn = typeof fetch;

const KNOWN_STATUSES: readonly TransactionStatus[] = [
  'PENDING',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
];

export const toStatus = (value: unknown): TransactionStatus =>
  KNOWN_STATUSES.includes(value as TransactionStatus)
    ? (value as TransactionStatus)
    : 'ERROR';

/** Integrity signature: sha256(reference + amountInCents + currency + integritySecret). */
export const integritySignature = (
  reference: string,
  amountInCents: number,
  currency: string,
  secret: string,
): string =>
  createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex');

interface MerchantResponse {
  data: {
    presigned_acceptance: { acceptance_token: string; permalink: string };
    presigned_personal_data_auth: {
      acceptance_token: string;
      permalink: string;
    };
  };
}

interface TransactionResponse {
  data: { id: string; status: string };
}

export class HttpPaymentGateway implements PaymentGateway {
  constructor(
    private readonly config: AppConfig['payment'],
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async getAcceptanceTokens(): Promise<Result<AcceptanceTokens, DomainError>> {
    const response = await this.request<MerchantResponse>(
      `/merchants/${this.config.publicKey}`,
    );
    if (!response.ok) return response;
    const {
      presigned_acceptance: terms,
      presigned_personal_data_auth: personal,
    } = response.value.data;
    return ok({
      acceptanceToken: terms.acceptance_token,
      personalDataAuthToken: personal.acceptance_token,
      termsUrl: terms.permalink,
      personalDataUrl: personal.permalink,
    });
  }

  async chargeCard(
    request: CardChargeRequest,
  ): Promise<Result<GatewayTransaction, DomainError>> {
    const response = await this.request<TransactionResponse>('/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.privateKey}` },
      body: JSON.stringify({
        amount_in_cents: request.amountInCents,
        currency: request.currency,
        customer_email: request.customerEmail,
        reference: request.reference,
        signature: integritySignature(
          request.reference,
          request.amountInCents,
          request.currency,
          this.config.integritySecret,
        ),
        acceptance_token: request.acceptanceToken,
        accept_personal_auth: request.personalDataAuthToken,
        payment_method: {
          type: 'CARD',
          token: request.cardToken,
          installments: request.installments,
        },
      }),
    });
    return response.ok ? ok(this.toTransaction(response.value)) : response;
  }

  async getTransaction(
    gatewayTransactionId: string,
  ): Promise<Result<GatewayTransaction, DomainError>> {
    const response = await this.request<TransactionResponse>(
      `/transactions/${encodeURIComponent(gatewayTransactionId)}`,
    );
    return response.ok ? ok(this.toTransaction(response.value)) : response;
  }

  private toTransaction({ data }: TransactionResponse): GatewayTransaction {
    return { id: data.id, status: toStatus(data.status) };
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<Result<T, DomainError>> {
    try {
      const response = await this.fetchFn(`${this.config.apiUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!response.ok) {
        return err(
          paymentGatewayError(
            `Payment gateway responded with HTTP ${response.status}`,
          ),
        );
      }
      return ok((await response.json()) as T);
    } catch {
      return err(paymentGatewayError('Payment gateway is unreachable'));
    }
  }
}
