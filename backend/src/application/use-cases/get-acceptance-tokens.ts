import { DomainError } from '../../domain/shared/errors';
import { Result } from '../../domain/shared/result';
import { AcceptanceTokens, PaymentGateway } from '../ports/payment-gateway';

export class GetAcceptanceTokens {
  constructor(private readonly gateway: PaymentGateway) {}

  execute(): Promise<Result<AcceptanceTokens, DomainError>> {
    return this.gateway.getAcceptanceTokens();
  }
}
