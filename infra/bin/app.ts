#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { join } from 'node:path';
import { CheckoutStack } from '../lib/checkout-stack';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See infra/README section in the root README.`);
  return value;
};

const app = new App();
new CheckoutStack(app, 'CheckoutStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' },
  apiCodePath: join(__dirname, '../../backend/dist-lambda'),
  webAssetsPath: join(__dirname, '../../frontend/dist'),
  paymentApiUrl: required('PAYMENT_API_URL'),
  paymentPublicKey: required('PAYMENT_PUBLIC_KEY'),
  secretsParameterName: process.env.PAYMENT_SECRETS_PARAMETER ?? '/checkout/payment',
});
