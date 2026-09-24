# 003 – Hexagonal architecture and Railway Oriented Programming

**Status:** accepted

## Context
Business rules must not live in controllers, and the code must be easy to test in isolation.

## Decision
- **Ports & adapters:** the domain and application layers depend only on interfaces (ports). DynamoDB repositories and the payment gateway HTTP client are adapters in the infrastructure layer. Controllers translate HTTP into use-case calls.
- **ROP:** every use case returns `Result<T, DomainError>`. Steps are chained so the first failure short-circuits the flow, without throwing exceptions for expected business errors. Controllers map each error type to an HTTP status.

## Consequences
- Use cases are unit-tested with in-memory fakes of the ports.
- Expected failures (out of stock, invalid input, gateway declined) are explicit in the type signatures.
