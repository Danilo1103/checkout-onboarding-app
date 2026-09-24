import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ProductRepository } from '../../application/ports/repositories';
import { Product } from '../../domain/product';
import { DomainError, notFound, outOfStock } from '../../domain/shared/errors';
import { err, ok, Result } from '../../domain/shared/result';
import { isConditionalFailure } from './client';

/**
 * Stored item keeps `available = stock - reserved` as its own attribute,
 * because DynamoDB condition expressions cannot evaluate arithmetic.
 */
export type ProductItem = Product & { readonly available: number };

export const toProduct = ({
  available: _available,
  ...product
}: ProductItem): Product => product;

export class DynamoProductRepository implements ProductRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly table: string,
  ) {}

  async findAll(): Promise<Product[]> {
    const { Items = [] } = await this.client.send(
      new ScanCommand({ TableName: this.table }),
    );
    return (Items as ProductItem[])
      .map(toProduct)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: string): Promise<Product | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { id } }),
    );
    return Item ? toProduct(Item as ProductItem) : null;
  }

  async reserve(
    id: string,
    quantity: number,
  ): Promise<Result<void, DomainError>> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { id },
          UpdateExpression:
            'SET reserved = reserved + :q, available = available - :q',
          ConditionExpression: 'attribute_exists(id) AND available >= :q',
          ExpressionAttributeValues: { ':q': quantity },
        }),
      );
      return ok(undefined);
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const exists = await this.findById(id);
      return err(
        exists
          ? outOfStock(`Not enough stock for product ${id}`)
          : notFound(`Product ${id} not found`),
      );
    }
  }

  async release(id: string, quantity: number): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { id },
        UpdateExpression:
          'SET reserved = reserved - :q, available = available + :q',
        ConditionExpression: 'reserved >= :q',
        ExpressionAttributeValues: { ':q': quantity },
      }),
    );
  }
}
