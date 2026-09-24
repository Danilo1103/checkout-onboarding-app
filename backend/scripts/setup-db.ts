/**
 * Creates the tables (local DynamoDB only, with --create-tables) and seeds the products.
 * Usage: pnpm db:setup            -> seed existing tables (AWS)
 *        pnpm db:setup:local      -> create tables in DynamoDB Local and seed
 */
import { CreateTableCommand, CreateTableCommandInput, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { AppConfig } from '../src/infrastructure/config/app-config';
import { createDynamoClient } from '../src/infrastructure/dynamodb/client';
import { DELIVERY_BY_TRANSACTION_INDEX } from '../src/infrastructure/dynamodb/dynamo-delivery.repository';
import { seedProducts } from '../src/infrastructure/dynamodb/seed';

// Only table and connection settings are needed here, not the payment keys.
const prefix = process.env.TABLE_PREFIX ?? 'checkout';
const config = {
  aws: { region: process.env.AWS_REGION ?? 'us-east-1', dynamoEndpoint: process.env.DYNAMODB_ENDPOINT || undefined },
  tables: {
    products: `${prefix}-products`,
    customers: `${prefix}-customers`,
    transactions: `${prefix}-transactions`,
    deliveries: `${prefix}-deliveries`,
  },
} as Pick<AppConfig, 'aws' | 'tables'>;
const client = createDynamoClient(config as AppConfig);

const tables: CreateTableCommandInput[] = [
  { TableName: config.tables.products, KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }], AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }], BillingMode: 'PAY_PER_REQUEST' },
  { TableName: config.tables.customers, KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }], AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }], BillingMode: 'PAY_PER_REQUEST' },
  { TableName: config.tables.transactions, KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }], AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }], BillingMode: 'PAY_PER_REQUEST' },
  {
    TableName: config.tables.deliveries,
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'transactionId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: DELIVERY_BY_TRANSACTION_INDEX,
        KeySchema: [{ AttributeName: 'transactionId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

const createTables = async () => {
  const raw = new DynamoDBClient({ region: config.aws.region, endpoint: config.aws.dynamoEndpoint, credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
  for (const table of tables) {
    try {
      await raw.send(new CreateTableCommand(table));
      console.log(`created ${table.TableName}`);
    } catch (error) {
      if ((error as Error).name !== 'ResourceInUseException') throw error;
      console.log(`exists  ${table.TableName}`);
    }
  }
};

const main = async () => {
  if (process.argv.includes('--create-tables')) {
    if (!config.aws.dynamoEndpoint) throw new Error('--create-tables is only allowed against DynamoDB Local');
    await createTables();
  }
  const inserted = await seedProducts(client, config.tables.products);
  console.log(`seeded ${inserted} new product(s) into ${config.tables.products}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
