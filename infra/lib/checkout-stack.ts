import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { CfnStage, HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  HttpVersion,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface CheckoutStackProps extends StackProps {
  /** Folder with the bundled Lambda (backend/dist-lambda). */
  readonly apiCodePath: string;
  /** Folder with the built SPA (frontend/dist). */
  readonly webAssetsPath: string;
  /** Sandbox base URL of the payment gateway, used by the browser to tokenize cards. */
  readonly paymentApiUrl: string;
  /** Public key of the payment gateway (safe to expose to the browser). */
  readonly paymentPublicKey: string;
  /** SSM SecureString parameter with the private payment keys (created outside the stack). */
  readonly secretsParameterName: string;
  readonly tablePrefix?: string;
}

export class CheckoutStack extends Stack {
  constructor(scope: Construct, id: string, props: CheckoutStackProps) {
    super(scope, id, props);
    const prefix = props.tablePrefix ?? 'checkout';

    // ---------- Data ----------
    const table = (name: string, key: string) =>
      new Table(this, `${name}Table`, {
        tableName: `${prefix}-${name.toLowerCase()}`,
        partitionKey: { name: key, type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      });
    const tables = [
      table('Products', 'id'),
      table('Customers', 'email'),
      table('Transactions', 'id'),
      table('Deliveries', 'id'),
    ];
    tables[3].addGlobalSecondaryIndex({
      indexName: 'transactionId-index',
      partitionKey: { name: 'transactionId', type: AttributeType.STRING },
    });

    // ---------- API ----------
    const apiFunction = new Function(this, 'ApiFunction', {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: 'index.handler',
      code: Code.fromAsset(props.apiCodePath),
      memorySize: 1024,
      timeout: Duration.seconds(20),
      logGroup: new LogGroup(this, 'ApiLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        NODE_ENV: 'production',
        TABLE_PREFIX: prefix,
        PAYMENT_SECRETS_PARAMETER: props.secretsParameterName,
      },
    });
    tables.forEach((t) => t.grantReadWriteData(apiFunction));
    StringParameter.fromSecureStringParameterAttributes(this, 'PaymentSecrets', {
      parameterName: props.secretsParameterName,
    }).grantRead(apiFunction);

    const httpApi = new HttpApi(this, 'HttpApi', {
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', apiFunction),
    });
    const stage = httpApi.defaultStage!.node.defaultChild as CfnStage;
    stage.defaultRouteSettings = { throttlingRateLimit: 20, throttlingBurstLimit: 40 };

    // ---------- Web ----------
    const bucket = new Bucket(this, 'WebBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const paymentOrigin = new URL(props.paymentApiUrl).origin;
    const securityHeaders = new ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          override: true,
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            `connect-src 'self' ${paymentOrigin}`,
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
            'upgrade-insecure-requests',
          ].join('; '),
        },
        strictTransportSecurity: {
          override: true,
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          preload: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { override: true, frameOption: HeadersFrameOption.DENY },
        referrerPolicy: { override: true, referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()', override: true },
        ],
      },
    });

    // The API is served under /api on the same domain: no CORS and a strict CSP.
    const apiDomain = Fn.select(2, Fn.split('/', httpApi.apiEndpoint));
    const distribution = new Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(apiDomain, { protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY }),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: securityHeaders,
        },
      },
      // Single page app: unknown paths serve index.html.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      })),
    });

    new BucketDeployment(this, 'WebStaticAssets', {
      destinationBucket: bucket,
      sources: [Source.asset(props.webAssetsPath, { exclude: ['index.html'] })],
      cacheControl: [CacheControl.setPublic(), CacheControl.maxAge(Duration.days(7))],
      prune: false,
    });
    new BucketDeployment(this, 'WebEntryPoint', {
      destinationBucket: bucket,
      sources: [
        Source.asset(props.webAssetsPath, { exclude: ['*', '!index.html'] }),
        Source.jsonData('config.json', {
          apiUrl: '/api',
          paymentApiUrl: props.paymentApiUrl,
          paymentPublicKey: props.paymentPublicKey,
        }),
      ],
      cacheControl: [CacheControl.noCache()],
      prune: false,
      distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'WebUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiDocsUrl', { value: `https://${distribution.distributionDomainName}/api/docs` });
    new CfnOutput(this, 'TablePrefix', { value: prefix });
  }
}
