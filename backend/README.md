# Backend

NestJS 11 + TypeScript API organized with Hexagonal Architecture (ports & adapters). Use cases follow Railway Oriented Programming.

## Scripts

| Command | Description |
|---|---|
| `pnpm start:local` | API on http://localhost:3000/api, reading `backend/.env` |
| `pnpm db:setup:local` | Creates the tables in DynamoDB Local and seeds the products |
| `pnpm db:setup` | Seeds products into existing tables (AWS) |
| `pnpm test` / `pnpm test:cov` | Unit and HTTP tests with Jest (coverage threshold 80%) |
| `pnpm test:e2e` | End-to-end test of the Nest app |
| `pnpm build:lambda` | Compiles with `tsc` and bundles the Lambda into `dist-lambda/` |
| `pnpm lint` | ESLint + Prettier |

Swagger UI: http://localhost:3000/api/docs

## Configuration

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default `3000`) |
| `AWS_REGION` | AWS region (default `us-east-1`) |
| `DYNAMODB_ENDPOINT` | DynamoDB Local endpoint, e.g. `http://localhost:8000`; empty in AWS |
| `TABLE_PREFIX` | Table name prefix (default `checkout`) |
| `PAYMENT_API_URL` | Payment gateway sandbox base URL |
| `PAYMENT_PUBLIC_KEY` / `PAYMENT_PRIVATE_KEY` | Gateway keys |
| `PAYMENT_INTEGRITY_SECRET` | Secret for the integrity signature |
| `PAYMENT_SECRETS_PARAMETER` | In AWS, SSM parameter with the `PAYMENT_*` values |
| `CORS_ORIGIN` | Allowed origins for local development (default `http://localhost:5173`) |
| `BASE_FEE_IN_CENTS` / `DELIVERY_FEE_IN_CENTS` | Checkout fees (defaults 5,000 and 10,000 COP) |

The app fails fast at start-up when a required variable is missing.

## Structure

```
src/
  domain/          Product, Customer, Transaction, Delivery, pricing, validation,
                   Result/ResultAsync and domain errors. No framework code.
  application/
    ports/         repository, settlement and payment gateway interfaces
    use-cases/     ListProducts, GetProduct, GetCheckoutQuote, GetAcceptanceTokens,
                   UpsertCustomer, CreateTransaction, SyncTransaction,
                   SettleTransaction, GetDelivery
  infrastructure/
    dynamodb/      repositories, transactional settlement, seed
    payment-gateway/ HTTP adapter with integrity signature and timeouts
    config/        environment loading and SSM secrets
    system/        UUID generator and clock
  interfaces/http/ controllers, DTOs, domain error → HTTP mapping, presenters
  app.module.ts    the only place that binds ports to adapters
  lambda.ts        AWS Lambda entry point
  test-utils/      in-memory adapters used by the use case tests
```

## Error mapping

| Domain error | HTTP |
|---|---|
| `VALIDATION` | 400 |
| `NOT_FOUND` | 404 |
| `OUT_OF_STOCK`, `CONFLICT` | 409 |
| `PAYMENT_GATEWAY` | 502 |

A payment that the gateway declines is not an API error: the transaction is returned with status `DECLINED` or `ERROR`.
