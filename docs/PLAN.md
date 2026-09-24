# Plan

Single-product checkout paid by credit card through a third-party payment gateway (sandbox).
This document captures the analysis and the decisions taken before writing code.

## 1. Business flow

The app follows a 5-step screen process:

1. **Product** – product with description, price and units in stock.
2. **Card & delivery** – "Pay with credit card" opens a modal that collects card data (validated, VISA / Mastercard detection) and delivery data.
3. **Summary** – backdrop with product amount, base fee and delivery fee, plus the pay button.
4. **Final status** – result of the payment (approved, declined or error).
5. **Product** – back to the product page with the updated stock.

The user's progress survives a page refresh.

## 2. Payment sequence

```
Frontend                         Backend API                        Payment gateway
   |  tokenize card (public key)  ------------------------------------>  POST /tokens/cards
   |  <------------------------------------------------------------------  card token
   |  POST /transactions  -------->  reserve stock (conditional write)
   |                                 create transaction PENDING + reference
   |                                 sign (reference+amount+currency+secret)
   |                                 POST /transactions (private key) ---->
   |  <-------- transaction id       <------------------------------------  gateway id, PENDING
   |  GET /transactions/:id (poll) ->  sync status with gateway  --------->  GET /transactions/:id
   |                                 APPROVED  -> confirm + create delivery
   |                                 DECLINED / ERROR / VOIDED -> release stock
   |  <-------- final status
```

Card number, CVC and expiry never reach the backend. The backend only stores the card token reference, the brand and the last four digits.

## 3. Architecture

**Frontend** – React + TypeScript (Vite), Redux Toolkit following the Flux pattern, mobile-first layout with flexbox / grid, Jest + React Testing Library.

**Backend** – NestJS + TypeScript with Hexagonal Architecture (ports & adapters) and Railway Oriented Programming for use cases.

```
backend/src/
  domain/          entities, value objects, domain errors (framework-free)
  application/     use cases returning Result<T, E>, ports (repositories, payment gateway)
  infrastructure/  DynamoDB repositories, payment gateway HTTP adapter, configuration
  interfaces/      HTTP controllers, DTOs, validation (no business logic)
```

**Database** – DynamoDB, one table per aggregate (products, customers, transactions, deliveries). DynamoDB Local in Docker for development.

**Infrastructure** – AWS CDK (TypeScript): DynamoDB tables, Lambda + API Gateway HTTP API for the backend, S3 + CloudFront for the SPA, HTTPS and security headers.

## 4. API (draft)

| Method | Path | Purpose |
|---|---|---|
| GET | `/products` | List products with stock |
| GET | `/products/:id` | Product detail |
| GET | `/checkout/quote?productId&quantity` | Amounts computed server-side (product, base fee, delivery fee, total) |
| GET | `/checkout/acceptance` | Acceptance tokens required by the gateway |
| POST | `/customers` | Create or update a customer by email |
| POST | `/transactions` | Reserve stock, create PENDING transaction and charge the card token |
| GET | `/transactions/:id` | Transaction status, synced with the gateway while PENDING |
| GET | `/deliveries/:transactionId` | Delivery assigned to an approved transaction |

The Swagger document is published by the API.

## 5. Data model (draft)

| Table | Key | Main attributes |
|---|---|---|
| products | `id` | name, description, imageUrl, priceInCents, stock, reserved |
| customers | `email` | fullName, phone, createdAt |
| transactions | `id` | reference, productId, quantity, customerEmail, amounts (product, base fee, delivery fee, total in cents), status, gatewayTransactionId, cardBrand, cardLast4, createdAt, updatedAt |
| deliveries | `id` (+ GSI `transactionId`) | transactionId, address, city, department, postalCode, recipient, phone, status |

## 6. Key decisions

- **Card tokenization in the browser** – sensitive card data goes straight to the gateway with the public key, reducing the backend's exposure.
- **Stock reservation** – stock is reserved with a conditional write when the transaction is created and released if the payment does not succeed, so concurrent buyers cannot oversell.
- **Amounts in cents, computed in the backend** – the frontend only displays them.
- **Idempotent finalization** – syncing a transaction twice never releases or confirms stock twice.
- **Signature in the backend only** – the integrity secret never leaves the server.

## 7. Delivery stages

Each stage is a branch and a pull request into `main`.

1. `docs/planning` – this plan and the decision records.
2. `chore/workspace-setup` – pnpm workspace, TypeScript, lint, formatting, Jest with 80% thresholds.
3. `feat/backend-domain` – entities, Result type, use cases, ports.
4. `feat/backend-adapters` – DynamoDB repositories, payment gateway adapter, controllers, Swagger, seed.
5. `feat/frontend-checkout` – the 5 screens, Redux store, card validation, persistence.
6. `test/coverage` – coverage above 80% in both packages.
7. `infra/aws-deploy` – CDK stacks, deploy, HTTPS and security headers.
8. `docs/readme` – README with setup, API, data model, coverage results and AI usage.

## 8. Risks

- Shared sandbox account: integrate only through API keys.
- Coverage above 80% in both packages is the largest scoring item; tests are written with each feature, not at the end.
- The repository must be public before submission.
