# Checkout Onboarding App

Single-product checkout paid by credit card through a third-party payment gateway (sandbox).
A customer picks a product, enters card and delivery data, reviews the summary, pays, and returns to the product page with the stock updated.

| | |
|---|---|
| **Live app** | https://d1ua32kt9ebezp.cloudfront.net |
| **API docs (Swagger)** | https://d1ua32kt9ebezp.cloudfront.net/api/docs |
| **OpenAPI file (Postman importable)** | [`docs/openapi.json`](docs/openapi.json) |
| **Plan and decisions** | [`docs/PLAN.md`](docs/PLAN.md), [`docs/decisions`](docs/decisions) (5 decision records) |

Test cards (sandbox): `4242 4242 4242 4242` approved, `4111 1111 1111 1111` declined. Any future expiry date and a 3-digit CVC.

---

## Business flow

```
1. Product  ->  2. Card & delivery (modal)  ->  3. Summary (backdrop)  ->  4. Final status  ->  5. Product (updated stock)
```

1. **Product page** – products with description, price and available units.
2. **Pay with credit card** – a modal (side sheet on desktop, bottom sheet on phones) collects card and delivery data. The card number is validated with Luhn, VISA and Mastercard are detected with their logos, and the expiry and CVC are checked.
3. **Summary** – a Material backdrop shows product amount, base fee, delivery fee and total. Amounts are always computed by the backend.
4. **Payment** – the backend reserves stock, creates the transaction as `PENDING`, charges the card through the gateway and polls until a final status. Approved payments consume the stock and assign the delivery; declined or failed payments release it.
5. **Final status** – approved, declined or error, with the purchased product, quantity and total, then back to the product page with fresh stock.

Progress survives a page refresh. Card data and the card token are never persisted: reloading before paying asks for the card again, while reloading after pressing *Pay* goes straight to the result of that payment.

---

## Architecture

```
                          ┌──────────────────────── AWS ─────────────────────────┐
 Browser (React SPA)      │                                                       │
   │  HTTPS               │  CloudFront ── /*      ──> S3 (private, OAC)          │
   ├─────────────────────►│      │  security headers + CSP                        │
   │                      │      └── /api/* ──> API Gateway (HTTP API, throttled) │
   │                      │                        └──> Lambda (NestJS, Node 22)  │
   │                      │                               ├──> DynamoDB (4 tables)│
   │                      │                               └──> SSM (payment keys) │
   │                      └───────────────────────────────────────────────────────┘
   │  card data + public key
   └──────────────────────────────► Payment gateway /tokens/cards  (card never reaches our backend)
                                     ▲
             Lambda: charge with private key + integrity signature, then poll status
```

### Backend – Hexagonal architecture (ports & adapters)

```
backend/src/
  domain/          entities, pricing, validation, Result type, domain errors (no framework code)
  application/     use cases (railway oriented programming) and ports
  infrastructure/  DynamoDB repositories, payment gateway HTTP adapter, config, SSM secrets
  interfaces/      NestJS controllers, DTO validation, error mapping (no business logic)
```

- **Ports** (`application/ports`) are interfaces for repositories, settlement and the payment gateway. Use cases only depend on them.
- **Adapters** (`infrastructure`) implement the ports with DynamoDB and HTTP. They are wired in `app.module.ts`, the only place that knows the concrete classes.
- **Railway Oriented Programming** – every use case returns `Result<T, DomainError>`. `ResultAsync` chains the steps with `andThen` / `map`; the first failure short-circuits the flow. Controllers translate each error type to an HTTP status (400, 404, 409, 502).

Example, `CreateTransaction`:

```
validate input → quote (server amounts) → upsert customer → reserve stock → create PENDING → charge → settle if final
```

### Frontend – Flux with Redux Toolkit

```
frontend/src/
  api/         HTTP client and card tokenization with the public key
  app/         store, typed hooks, persistence, injectable services
  features/    products and checkout slices (thunks) and screens
  components/  design system: Button, TextField, Modal, Skeleton, SmartImage...
  lib/         card, delivery and money helpers
```

- React 19 + TypeScript + Vite single page app, Redux Toolkit store, hand-written CSS (design tokens, flexbox, grid, CSS modules). Mobile first, down to iPhone SE (375×667).
- Side effects (API, tokenization, polling delay) are injected into thunks, so the flow is fully testable.
- Images are optimized WebP (3–26 KB) with `srcset`, reserved aspect ratio, skeleton background and fade-in. Lists and the summary use skeletons while loading.

---

## API

Base path: `/api`. Full contract in Swagger (`/api/docs`) and [`docs/openapi.json`](docs/openapi.json).

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | Products with available units |
| GET | `/api/products/:id` | Product detail |
| GET | `/api/checkout/quote?productId&quantity` | Amounts computed on the server |
| GET | `/api/checkout/acceptance` | Links to the documents the customer must accept |
| POST | `/api/customers` | Create or update a customer by email |
| POST | `/api/transactions` | Reserve stock, create `PENDING` transaction, charge the card token. Idempotent by `idempotencyKey` |
| GET | `/api/transactions/:id` | Status, refreshed from the gateway while `PENDING` |
| GET | `/api/deliveries/:transactionId` | Delivery assigned to an approved transaction |
| GET | `/api/health` | Health check |

Validation rejects unknown fields (`whitelist` + `forbidNonWhitelisted`), wrong types, invalid emails, phones, postal codes, quantities (1–5) and installments (1–36).

---

## Data model (DynamoDB)

| Table | Key | Attributes |
|---|---|---|
| `checkout-products` | `id` | name, description, imageUrl, priceInCents, stock, reserved, available |
| `checkout-customers` | `email` | fullName, phone, createdAt, updatedAt |
| `checkout-transactions` | `id` | reference, productId, quantity, customerEmail, amounts (product, base fee, delivery fee, total), currency, status, gatewayTransactionId, cardBrand, cardLast4, shipping, createdAt, updatedAt |
| `checkout-deliveries` | `id` + GSI `transactionId-index` | transactionId, productId, quantity, recipient, phone, addressLine, city, region, postalCode, status |

**Stock consistency** – `available = stock - reserved` is stored because DynamoDB conditions cannot do arithmetic.

| Moment | Write | Condition |
|---|---|---|
| Create transaction | `reserved += q`, `available -= q` | `available >= q` |
| Approved | transaction status + `stock -= q`, `reserved -= q` + delivery, in one `TransactWriteItems` | transaction is still `PENDING` |
| Declined / error / voided | transaction status + `reserved -= q`, `available += q`, in one `TransactWriteItems` | transaction is still `PENDING` |

Settlement is idempotent and concurrent buyers cannot oversell. See [`docs/decisions/004-stock-reservation.md`](docs/decisions/004-stock-reservation.md).

**Idempotent payments** – before paying, the SPA generates a UUID, stores it and sends it as `idempotencyKey`. The backend uses it as the transaction id and creates it with a conditional write, so a double click, a retry after a network error or a reload during payment returns the same transaction instead of charging twice. After a reload the SPA polls that id; if the request never reached the server, it reports that no charge was made.

---

## Security

- **Card data never reaches the backend**: the browser tokenizes the card with the gateway public key; the API only receives the token, brand and last four digits.
- **Secrets**: private key, integrity secret and events secret live in an SSM `SecureString` parameter, loaded by the Lambda at start-up. They are not in the code, the CloudFormation template or the SPA.
- **Integrity signature** computed only on the server: `sha256(reference + amountInCents + currency + secret)`.
- **HTTPS everywhere** with CloudFront; the API is served on the same origin under `/api`.
- **Security headers** (CloudFront and Helmet): strict Content-Security-Policy, HSTS with preload, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- **Private S3 bucket** with Origin Access Control and a TLS-only bucket policy.
- **Rate limiting** in API Gateway and in the API (stricter on `POST /transactions`).
- **Input validation** on every endpoint, amounts computed on the server, idempotent payment creation and settlement.
- **Least privilege IAM**: the Lambda can only access its four tables and its secrets parameter.

---

## Tests and coverage

Jest in every package. Coverage thresholds are enforced at 80% (the test run fails below it).

| Package | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| Backend | 85 | 99.81% | 92.68% | 99.21% | 100% |
| Frontend | 73 | 98.26% | 96.77% | 97.90% | 99.42% |
| Infrastructure (CDK) | 9 | 100% | 100% | 100% | 100% |

```bash
pnpm test:cov                     # all packages
pnpm --filter backend test:e2e
```

What is covered:

- **Backend** – domain rules, every use case with in-memory adapters (approved, declined, error, out of stock, concurrent reservation, idempotent payments and settlement), DynamoDB repositories with a mocked SDK, the payment gateway adapter with mocked HTTP, the full HTTP API with Supertest (validation, error codes, security headers, Swagger) and the Lambda handler.
- **Frontend** – card and delivery validation, API client and tokenization, the Redux store (flow, polling, idempotency key, persistence without the card token, resuming a payment after a reload), mobile viewport handling, every screen with React Testing Library and one test for the full checkout.
- **Infrastructure** – CDK assertions for the private bucket, CSP and headers, IAM scope, throttling, SPA routing that keeps real API errors, and that no private key ends up in the template.

The flow was also verified end to end against the gateway sandbox (approved, declined, out of stock and reloading during payment), locally and on the deployed app, in Chrome at 375×667, 820×1180 and 1440×900, and on Safari for iPhone.

---

## Run locally

Requirements: Node 22+, pnpm 10, Docker.

```bash
pnpm install
docker compose up -d                       # DynamoDB Local on :8000
cp .env.example backend/.env               # fill the payment gateway sandbox values
cp .env.example frontend/.env.local        # only the VITE_* values are used
pnpm --filter backend db:setup:local       # create tables and seed products
pnpm --filter backend start:local          # API on http://localhost:3000/api
pnpm --filter frontend dev                 # SPA on http://localhost:5173
```

## Deploy to AWS

```bash
# 1. Store the private payment keys once (encrypted with KMS)
aws ssm put-parameter --name /checkout/payment --type SecureString \
  --value '{"PAYMENT_API_URL":"...","PAYMENT_PUBLIC_KEY":"...","PAYMENT_PRIVATE_KEY":"...","PAYMENT_INTEGRITY_SECRET":"..."}'

# 2. Bootstrap CDK once per account and region
pnpm --filter infra exec cdk bootstrap

# 3. Build and deploy (the public values are passed at deploy time)
PAYMENT_API_URL=<sandbox base url> PAYMENT_PUBLIC_KEY=<public key> pnpm deploy

# 4. Seed the products
pnpm seed:aws
```

The stack outputs the web URL and the Swagger URL.

---

## Decisions and known limitations

- **DynamoDB over PostgreSQL** – no VPC or NAT gateway for the Lambda, free tier, atomic conditional writes for stock.
- **Tokenization in the browser** – keeps card data out of the backend.
- **Polling instead of webhooks** – simpler for a sandbox shared by many candidates. A production version would also verify gateway events with the events secret.
- **Abandoned reservations** – a reservation is released when the payment fails; a reservation for a transaction that never reaches a final status would need a scheduled job.
- **Next steps** – cart with several products, a dedicated checkout page, gateway webhooks, reservation expiry and end-to-end browser tests in CI.

---

## AI usage

I used an AI coding assistant from the terminal throughout the project, following a spec-driven workflow: plan, implement in small stages, verify, review.

- **Planning** – analysed the test requirements and the gateway documentation with the assistant, compared options (PostgreSQL vs DynamoDB, where to tokenize the card, how to keep stock consistent) and wrote the plan and decision records in [`docs/`](docs) before writing code. The final decisions were mine.
- **Implementation** – the assistant generated the scaffolding, adapters, tests and infrastructure stage by stage, one branch and pull request per stage.
- **Verification** – every stage ended with tests and coverage in green, plus manual checks against the real sandbox, in the browser and on my phone. Those checks caught issues that unit tests with mocks could not: single-use acceptance tokens, stock left reserved when storing a transaction failed, DTO instances that DynamoDB refused to store, a focus loop in the modal, API 404s rewritten by CloudFront, the mobile keyboard hiding the form, and a reload during payment sending the customer back to the form.
- **Review** – I reviewed the security of card handling, the validations, the stock rules and the UI decisions (for example the side sheet on desktop and the progress steps) before merging.
