import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CustomerRepository } from '../../application/ports/repositories';
import { Clock } from '../../application/ports/system';
import { Customer } from '../../domain/customer';

export class DynamoCustomerRepository implements CustomerRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly table: string,
    private readonly clock: Clock,
  ) {}

  async upsert(customer: Customer): Promise<Customer> {
    const now = this.clock.now().toISOString();
    await this.client.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { email: customer.email },
        UpdateExpression:
          'SET fullName = :name, phone = :phone, updatedAt = :now, createdAt = if_not_exists(createdAt, :now)',
        ExpressionAttributeValues: {
          ':name': customer.fullName,
          ':phone': customer.phone,
          ':now': now,
        },
      }),
    );
    return customer;
  }
}
