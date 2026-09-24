import { GetParameterCommand } from '@aws-sdk/client-ssm';
import { loadSecrets } from './load-secrets';

const clientReturning = (Value?: string) => ({
  send: jest.fn().mockResolvedValue({ Parameter: { Value } }),
});

describe('loadSecrets', () => {
  it('does nothing when no parameter is configured', async () => {
    const client = clientReturning('{}');
    await loadSecrets({}, client);
    expect(client.send).not.toHaveBeenCalled();
  });

  it('loads only PAYMENT_ keys from the decrypted parameter', async () => {
    const env: NodeJS.ProcessEnv = {
      PAYMENT_SECRETS_PARAMETER: '/checkout/payment',
    };
    const client = clientReturning(
      JSON.stringify({ PAYMENT_PRIVATE_KEY: 'prv', NODE_OPTIONS: '--inspect' }),
    );
    await loadSecrets(env, client);

    const command = client.send.mock.calls[0][0] as GetParameterCommand;
    expect(command.input).toEqual({
      Name: '/checkout/payment',
      WithDecryption: true,
    });
    expect(env.PAYMENT_PRIVATE_KEY).toBe('prv');
    expect(env.NODE_OPTIONS).toBeUndefined();
  });

  it('fails fast when the parameter is empty', async () => {
    await expect(
      loadSecrets(
        { PAYMENT_SECRETS_PARAMETER: '/x' },
        clientReturning() as never,
      ),
    ).rejects.toThrow('Secrets parameter /x is empty');
  });
});
