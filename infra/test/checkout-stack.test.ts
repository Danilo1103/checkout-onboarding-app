import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { join } from 'node:path';
import { CheckoutStack } from '../lib/checkout-stack';

const template = Template.fromStack(
  new CheckoutStack(new App(), 'TestStack', {
    env: { account: '111111111111', region: 'us-east-1' },
    apiCodePath: join(__dirname, 'fixtures/api'),
    webAssetsPath: join(__dirname, 'fixtures/web'),
    paymentApiUrl: 'https://gateway.example.com/v1',
    paymentPublicKey: 'pub_test',
    secretsParameterName: '/checkout/payment',
  }),
);

describe('CheckoutStack', () => {
  it('creates the four tables with on-demand billing and the delivery index', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 4);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'checkout-deliveries',
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [Match.objectLike({ IndexName: 'transactionId-index' })],
    });
  });

  it('runs the API on Node 22 ARM with the secrets parameter name, not the secrets', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      Environment: {
        Variables: { NODE_ENV: 'production', TABLE_PREFIX: 'checkout', PAYMENT_SECRETS_PARAMETER: '/checkout/payment' },
      },
    });
    const functions = JSON.stringify(template.findResources('AWS::Lambda::Function'));
    expect(functions).not.toMatch(/prv_|integrity/i);
  });

  it('lets the API read only its secrets parameter', () => {
    const statements = Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
      (policy) => policy.Properties.PolicyDocument.Statement as { Action: string[]; Resource: unknown }[],
    );
    const ssm = statements.filter((s) => [s.Action].flat().some((action) => action.startsWith('ssm:')));
    expect(ssm).toHaveLength(1);
    expect(ssm[0].Action).toContain('ssm:GetParameter');
    expect(JSON.stringify(ssm[0].Resource)).toContain(':parameter/checkout/payment');
  });

  it('throttles the HTTP API', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    });
  });

  it('keeps the web bucket private and TLS-only', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } }),
        ]),
      },
    });
  });

  it('serves the SPA over HTTPS with the API under /api and no caching for it', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        CacheBehaviors: [
          Match.objectLike({
            PathPattern: '/api/*',
            ViewerProtocolPolicy: 'https-only',
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
          }),
        ],
        CustomErrorResponses: Match.arrayWith([Match.objectLike({ ErrorCode: 404, ResponseCode: 200 })]),
      }),
    });
  });

  it('adds security headers with a strict CSP', () => {
    template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: {
            Override: true,
            ContentSecurityPolicy: Match.stringLikeRegexp("connect-src 'self' https://gateway.example.com;.*frame-ancestors 'none'"),
          },
          StrictTransportSecurity: Match.objectLike({ AccessControlMaxAgeSec: 31536000, Preload: true }),
          FrameOptions: { FrameOption: 'DENY', Override: true },
          ContentTypeOptions: { Override: true },
        }),
      }),
    });
  });

  it('never places private payment keys in the template', () => {
    expect(JSON.stringify(template.toJSON())).not.toMatch(/prv_|integrity_/i);
  });
});
