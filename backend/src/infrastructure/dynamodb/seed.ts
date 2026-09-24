import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from '../../domain/product';
import { isConditionalFailure } from './client';
import { ProductItem } from './dynamo-product.repository';

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod-headphones',
    name: 'Audífonos inalámbricos Aurora',
    description:
      'Audífonos Bluetooth over-ear con cancelación activa de ruido y hasta 30 horas de batería.',
    imageUrl: '/images/headphones.webp',
    priceInCents: 34_990_000,
    stock: 12,
    reserved: 0,
  },
  {
    id: 'prod-smartwatch',
    name: 'Reloj inteligente Pulse',
    description:
      'Resistente al agua, con monitor de ritmo cardíaco, GPS y pantalla AMOLED de 1.4 pulgadas.',
    imageUrl: '/images/smartwatch.webp',
    priceInCents: 52_900_000,
    stock: 6,
    reserved: 0,
  },
  {
    id: 'prod-keyboard',
    name: 'Teclado inalámbrico Nimbus',
    description:
      'Teclado delgado de aluminio con conexión Bluetooth y batería recargable por USB-C.',
    imageUrl: '/images/keyboard.webp',
    priceInCents: 28_500_000,
    stock: 3,
    reserved: 0,
  },
];

/** Inserts products that do not exist yet; existing stock is never overwritten. */
export const seedProducts = async (
  client: DynamoDBDocumentClient,
  table: string,
  products: Product[] = SEED_PRODUCTS,
): Promise<number> => {
  let inserted = 0;
  for (const product of products) {
    const item: ProductItem = {
      ...product,
      available: product.stock - product.reserved,
    };
    try {
      await client.send(
        new PutCommand({
          TableName: table,
          Item: item,
          ConditionExpression: 'attribute_not_exists(id)',
        }),
      );
      inserted += 1;
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
    }
  }
  return inserted;
};
