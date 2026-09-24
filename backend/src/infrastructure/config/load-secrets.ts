import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * In AWS the payment gateway keys live in an SSM SecureString parameter
 * (JSON with PAYMENT_* entries). They are loaded into the environment once,
 * before the app configuration is read. Locally nothing happens.
 */
export const loadSecrets = async (
  env: NodeJS.ProcessEnv = process.env,
  client: Pick<SSMClient, 'send'> = new SSMClient({}),
): Promise<void> => {
  const name = env.PAYMENT_SECRETS_PARAMETER;
  if (!name) return;
  const { Parameter } = await client.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );
  if (!Parameter?.Value) throw new Error(`Secrets parameter ${name} is empty`);
  const values = JSON.parse(Parameter.Value) as Record<string, string>;
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith('PAYMENT_')) env[key] = value;
  }
};
