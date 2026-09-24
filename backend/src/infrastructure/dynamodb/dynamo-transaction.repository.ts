import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { TransactionRepository } from '../../application/ports/repositories';
import { Transaction } from '../../domain/transaction';
import { isConditionalFailure } from './client';

export class DynamoTransactionRepository implements TransactionRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly table: string,
  ) {}

  async create(transaction: Transaction): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: transaction,
          ConditionExpression: 'attribute_not_exists(id)',
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalFailure(error)) return false;
      throw error;
    }
  }

  async findById(id: string): Promise<Transaction | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { id } }),
    );
    return (Item as Transaction | undefined) ?? null;
  }

  async attachGatewayId(
    id: string,
    gatewayTransactionId: string,
    updatedAt: string,
  ): Promise<Transaction> {
    const { Attributes } = await this.client.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { id },
        UpdateExpression: 'SET gatewayTransactionId = :gw, updatedAt = :now',
        ExpressionAttributeValues: {
          ':gw': gatewayTransactionId,
          ':now': updatedAt,
        },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return Attributes as Transaction;
  }
}
