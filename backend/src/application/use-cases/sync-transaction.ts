import { DomainError, notFound } from '../../domain/shared/errors';
import { err, ok, ResultAsync } from '../../domain/shared/result';
import { isFinal, Transaction } from '../../domain/transaction';
import { PaymentGateway } from '../ports/payment-gateway';
import { TransactionRepository } from '../ports/repositories';
import { SettleTransaction } from './settle-transaction';

/**
 * Returns a transaction, refreshing its status from the gateway while it is PENDING.
 * Gateway failures keep the transaction PENDING so the client can retry later.
 */
export class SyncTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly gateway: PaymentGateway,
    private readonly settle: SettleTransaction,
  ) {}

  execute(id: string): ResultAsync<Transaction, DomainError> {
    return ResultAsync.from(this.find(id)).map((transaction) =>
      this.refresh(transaction),
    );
  }

  private async find(id: string) {
    const transaction = await this.transactions.findById(id);
    return transaction
      ? ok(transaction)
      : err(notFound(`Transaction ${id} not found`));
  }

  private async refresh(transaction: Transaction): Promise<Transaction> {
    if (isFinal(transaction.status) || !transaction.gatewayTransactionId)
      return transaction;

    const remote = await this.gateway.getTransaction(
      transaction.gatewayTransactionId,
    );
    if (!remote.ok || !isFinal(remote.value.status)) return transaction;

    await this.settle.execute(transaction, remote.value.status);
    return (await this.transactions.findById(transaction.id)) ?? transaction;
  }
}
