import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { SEED_PRODUCTS, seedProducts } from './seed';

const ddb = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'us-east-1' }),
);
const exists = () =>
  Object.assign(new Error('exists'), {
    name: 'ConditionalCheckFailedException',
  });

describe('seedProducts', () => {
  beforeEach(() => ddb.reset());

  it('inserts missing products with their available units and skips existing ones', async () => {
    ddb.on(PutCommand).resolvesOnce({}).rejectsOnce(exists()).resolves({});
    const inserted = await seedProducts(client, 'products');

    expect(inserted).toBe(SEED_PRODUCTS.length - 1);
    expect(ddb.commandCalls(PutCommand)[0].args[0].input.Item).toMatchObject({
      available: SEED_PRODUCTS[0].stock,
    });
  });

  it('rethrows unexpected errors', async () => {
    ddb.on(PutCommand).rejects(new Error('denied'));
    await expect(seedProducts(client, 'products')).rejects.toThrow('denied');
  });
});
