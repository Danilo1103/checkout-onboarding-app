import { Delivery } from '../../domain/delivery';
import { DomainError, notFound } from '../../domain/shared/errors';
import { err, ok, Result } from '../../domain/shared/result';
import { DeliveryRepository } from '../ports/repositories';

export class GetDelivery {
  constructor(private readonly deliveries: DeliveryRepository) {}

  async execute(transactionId: string): Promise<Result<Delivery, DomainError>> {
    const delivery = await this.deliveries.findByTransactionId(transactionId);
    return delivery
      ? ok(delivery)
      : err(notFound(`No delivery for transaction ${transactionId}`));
  }
}
