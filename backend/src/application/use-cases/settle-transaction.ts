import { Delivery } from '../../domain/delivery';
import { Transaction, TransactionStatus } from '../../domain/transaction';
import { SettlementRepository } from '../ports/repositories';
import { Clock, IdGenerator } from '../ports/system';

/**
 * Applies a final gateway status to a PENDING transaction.
 * APPROVED assigns the delivery and consumes the reserved stock;
 * any other final status releases the reservation.
 */
export class SettleTransaction {
  constructor(
    private readonly settlements: SettlementRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    transaction: Transaction,
    status: TransactionStatus,
  ): Promise<Transaction> {
    const now = this.clock.now().toISOString();
    const settled: Transaction = { ...transaction, status, updatedAt: now };

    if (status === 'APPROVED') {
      const delivery: Delivery = {
        id: this.ids.next(),
        transactionId: transaction.id,
        productId: transaction.productId,
        quantity: transaction.quantity,
        status: 'ASSIGNED',
        createdAt: now,
        ...transaction.shipping,
      };
      await this.settlements.settleApproved(settled, delivery);
    } else {
      await this.settlements.settleRejected(settled);
    }
    return settled;
  }
}
