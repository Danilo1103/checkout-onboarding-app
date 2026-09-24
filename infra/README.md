# Infrastructure

AWS CDK (TypeScript) stack `CheckoutStack`.

| Resource | Details |
|---|---|
| DynamoDB | `checkout-products`, `checkout-customers`, `checkout-transactions`, `checkout-deliveries` (GSI `transactionId-index`), on-demand billing |
| Lambda | NestJS API, Node 22, ARM64, bundled from `backend/dist-lambda` |
| API Gateway | HTTP API with stage throttling (20 rps, burst 40) |
| S3 | Private bucket for the SPA, Origin Access Control, TLS only |
| CloudFront | HTTPS, `/api/*` routed to the API without caching, SPA routing function, security headers and CSP |
| SSM | `SecureString` parameter with the private payment keys (created outside the stack) |

## Deploy

```bash
# once: secrets and CDK bootstrap
aws ssm put-parameter --name /checkout/payment --type SecureString --value '{"PAYMENT_API_URL":"...","PAYMENT_PUBLIC_KEY":"...","PAYMENT_PRIVATE_KEY":"...","PAYMENT_INTEGRITY_SECRET":"..."}'
PAYMENT_API_URL=... PAYMENT_PUBLIC_KEY=... pnpm exec cdk bootstrap

# from the repository root: build backend and frontend, then deploy
PAYMENT_API_URL=... PAYMENT_PUBLIC_KEY=... pnpm deploy
pnpm seed:aws
```

`PAYMENT_API_URL` and `PAYMENT_PUBLIC_KEY` are public values used by the browser; they are passed at deploy time and written to the SPA `config.json`.

## Tests

`pnpm test` runs CDK assertion tests: private bucket, CSP and security headers, IAM scope for the secrets parameter, throttling, SPA routing that keeps real API errors, and that no private key ends up in the template.
