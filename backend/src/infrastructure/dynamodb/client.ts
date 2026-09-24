import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AppConfig } from '../config/app-config';

export const DYNAMO_CLIENT = Symbol('DynamoDocumentClient');

export const createDynamoClient = (config: AppConfig): DynamoDBDocumentClient =>
  DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: config.aws.region,
      ...(config.aws.dynamoEndpoint
        ? {
            endpoint: config.aws.dynamoEndpoint,
            credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
          }
        : {}),
    }),
    {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    },
  );

export const isConditionalFailure = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ConditionalCheckFailedException') return true;
  if (error.name !== 'TransactionCanceledException') return false;
  const reasons =
    (error as Error & { CancellationReasons?: { Code?: string }[] })
      .CancellationReasons ?? [];
  return reasons.some((reason) => reason.Code === 'ConditionalCheckFailed');
};
