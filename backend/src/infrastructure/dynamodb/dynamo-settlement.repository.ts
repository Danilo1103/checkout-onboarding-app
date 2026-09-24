import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { SettlementRepository } from '../../application/ports/repositories';
import { Delivery } from '../../domain/delivery';
import { Transaction } from '../../domain/transaction';
import { AppConfig } from '../config/app-config';
import { isConditionalFailure } from './client';

type Tables = AppConfig['tables'];

/**
 * Applies the payment outcome in a single DynamoDB transaction.
 * Every write is conditioned on the transaction still being PENDING, so a
 * second settlement attempt is rejected by DynamoDB and ignored here.
 */
export class DynamoSettlementRepository implements SettlementRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: Tables,
  ) {}

  async settleApproved(
    transaction: Transaction,
    delivery: Delivery,
  ): Promise<void> {
    await this.run([
      this.finalizeTransaction(transaction),
      {
        Update: {
          TableName: this.tables.products,
          Key: { id: transaction.productId },
          UpdateExpression: 'SET stock = stock - :q, reserved = reserved - :q',
          ExpressionAttributeValues: { ':q': transaction.quantity },
        },
      },
      {
        Put: {
          TableName: this.tables.deliveries,
          Item: delivery,
          ConditionExpression: 'attribute_not_exists(id)',
        },
      },
    ]);
  }

  async settleRejected(transaction: Transaction): Promise<void> {
    await this.run([
      this.finalizeTransaction(transaction),
      {
        Update: {
          TableName: this.tables.products,
          Key: { id: transaction.productId },
          UpdateExpression:
            'SET reserved = reserved - :q, available = available + :q',
          ExpressionAttributeValues: { ':q': transaction.quantity },
        },
      },
    ]);
  }

  private finalizeTransaction(transaction: Transaction) {
    return {
      Update: {
        TableName: this.tables.transactions,
        Key: { id: transaction.id },
        UpdateExpression: 'SET #status = :status, updatedAt = :now',
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': transaction.status,
          ':now': transaction.updatedAt,
          ':pending': 'PENDING',
        },
      },
    };
  }

  private async run(
    items: NonNullable<TransactWriteCommand['input']['TransactItems']>,
  ): Promise<void> {
    try {
      await this.client.send(
        new TransactWriteCommand({ TransactItems: items }),
      );
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
    }
  }
}
