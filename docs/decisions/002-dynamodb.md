# 002 – DynamoDB as the database

**Status:** accepted

## Context
The API runs on AWS Lambda. A relational database such as RDS would require either a public database endpoint or a VPC with a NAT gateway so the Lambda can also reach the payment gateway.

## Decision
Use DynamoDB with one table per aggregate: `products`, `customers`, `transactions`, `deliveries`. Local development uses DynamoDB Local in Docker.

## Consequences
- No VPC or NAT gateway; the stack stays within the free tier.
- Access patterns are designed up front (get by id, delivery by transaction id through a GSI).
- Stock changes use conditional writes (`ConditionExpression`) and multi-item changes use `TransactWriteItems`, so updates are atomic.
- The database sits behind repository ports, so it can be replaced by writing new adapters.
