import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DeliveryRepository } from '../../application/ports/repositories';
import { Delivery } from '../../domain/delivery';

export const DELIVERY_BY_TRANSACTION_INDEX = 'transactionId-index';

export class DynamoDeliveryRepository implements DeliveryRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly table: string,
  ) {}

  async findByTransactionId(transactionId: string): Promise<Delivery | null> {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: DELIVERY_BY_TRANSACTION_INDEX,
        KeyConditionExpression: 'transactionId = :tx',
        ExpressionAttributeValues: { ':tx': transactionId },
        Limit: 1,
      }),
    );
    return (Items[0] as Delivery | undefined) ?? null;
  }
}
