# 004 – Stock reservation during payment

**Status:** accepted

## Context
Two customers could pay for the last unit at the same time. Decrementing stock only after approval could approve a payment for a product that is already gone.

## Decision
When a transaction is created, reserve the units with a conditional update (`stock - reserved >= quantity`). When the payment reaches a final status:
- **APPROVED:** decrement stock, clear the reservation and create the delivery, in one `TransactWriteItems` call.
- **DECLINED / ERROR / VOIDED:** release the reservation.

Finalization is idempotent: it only applies when the transaction moves out of `PENDING`.

## Consequences
- No overselling under concurrency.
- Abandoned reservations can be released by a scheduled job (out of scope for this version, documented as a known limitation).
