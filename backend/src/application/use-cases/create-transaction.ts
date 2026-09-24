import { Customer } from '../../domain/customer';
import { ShippingInfo } from '../../domain/delivery';
import { DomainError, validationError } from '../../domain/shared/errors';
import { err, ok, Result, ResultAsync } from '../../domain/shared/result';
import { CardBrand, isFinal, Transaction } from '../../domain/transaction';
import { validateCardSummary, validateShipping } from '../../domain/validation';
import { PaymentGateway } from '../ports/payment-gateway';
import {
  ProductRepository,
  TransactionRepository,
} from '../ports/repositories';
import { Clock, IdGenerator } from '../ports/system';
import { GetCheckoutQuote, Quote } from './get-checkout-quote';
import { SettleTransaction } from './settle-transaction';
import { UpsertCustomer } from './upsert-customer';

export const MAX_INSTALLMENTS = 36;

export interface CreateTransactionInput {
  readonly productId: string;
  readonly quantity: number;
  readonly customer: Customer;
  readonly shipping: ShippingInfo;
  readonly card: {
    readonly token: string;
    readonly brand: CardBrand;
    readonly last4: string;
    readonly installments: number;
  };
  readonly acceptanceToken: string;
  readonly personalDataAuthToken: string;
}

interface Context {
  readonly input: CreateTransactionInput;
  readonly quote: Quote;
  readonly customer: Customer;
}

export class CreateTransaction {
  constructor(
    private readonly getQuote: GetCheckoutQuote,
    private readonly upsertCustomer: UpsertCustomer,
    private readonly products: ProductRepository,
    private readonly transactions: TransactionRepository,
    private readonly gateway: PaymentGateway,
    private readonly settle: SettleTransaction,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute(
    input: CreateTransactionInput,
  ): ResultAsync<Transaction, DomainError> {
    return ResultAsync.from(validateInput(input))
      .andThen(() => this.getQuote.execute(input.productId, input.quantity))
      .andThen((quote) =>
        this.upsertCustomer
          .execute(input.customer)
          .map((customer): Context => ({ input, quote, customer })),
      )
      .andThen(async (ctx) => {
        const reserved = await this.products.reserve(
          ctx.input.productId,
          ctx.input.quantity,
        );
        return reserved.ok ? ok(ctx) : reserved;
      })
      .map((ctx) => this.createPending(ctx))
      .map((transaction) => this.charge(transaction, input));
  }

  private async createPending({
    input,
    quote,
    customer,
  }: Context): Promise<Transaction> {
    const now = this.clock.now().toISOString();
    const id = this.ids.next();
    const transaction: Transaction = {
      id,
      reference: `TX-${id}`,
      productId: input.productId,
      quantity: input.quantity,
      customerEmail: customer.email,
      amounts: quote.amounts,
      currency: quote.currency,
      status: 'PENDING',
      cardBrand: input.card.brand,
      cardLast4: input.card.last4,
      shipping: input.shipping,
      createdAt: now,
      updatedAt: now,
    };
    await this.transactions.create(transaction);
    return transaction;
  }

  private async charge(
    transaction: Transaction,
    input: CreateTransactionInput,
  ): Promise<Transaction> {
    const charged = await this.gateway.chargeCard({
      reference: transaction.reference,
      amountInCents: transaction.amounts.totalInCents,
      currency: transaction.currency,
      customerEmail: transaction.customerEmail,
      cardToken: input.card.token,
      installments: input.card.installments,
      acceptanceToken: input.acceptanceToken,
      personalDataAuthToken: input.personalDataAuthToken,
    });

    if (!charged.ok) return this.settle.execute(transaction, 'ERROR');

    const withGatewayId = await this.transactions.attachGatewayId(
      transaction.id,
      charged.value.id,
      this.clock.now().toISOString(),
    );
    return isFinal(charged.value.status)
      ? this.settle.execute(withGatewayId, charged.value.status)
      : withGatewayId;
  }
}

const validateInput = (
  input: CreateTransactionInput,
): Result<CreateTransactionInput, DomainError> => {
  const errors = [
    ...validateShipping(input.shipping),
    ...validateCardSummary(input.card.brand, input.card.last4),
  ];
  if (!input.card.token?.trim()) errors.push('card.token is required');
  if (
    !Number.isInteger(input.card.installments) ||
    input.card.installments < 1 ||
    input.card.installments > MAX_INSTALLMENTS
  ) {
    errors.push(
      `card.installments must be an integer between 1 and ${MAX_INSTALLMENTS}`,
    );
  }
  if (!input.acceptanceToken?.trim())
    errors.push('acceptanceToken is required');
  if (!input.personalDataAuthToken?.trim())
    errors.push('personalDataAuthToken is required');
  return errors.length === 0
    ? ok(input)
    : err(validationError('Invalid transaction request', errors));
};
