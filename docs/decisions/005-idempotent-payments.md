# 005 – Idempotent payments

**Status:** accepted

## Context
Manual testing showed that reloading the page right after pressing *Pay* sent the customer back to the card form, even though the payment could already exist on the server. Paying again could charge twice. Double clicks and retries after network errors have the same risk.

## Decision
- The SPA generates a UUID before paying, stores it with the checkout progress and sends it as `idempotencyKey`.
- The backend uses that key as the transaction id. If a transaction with that id exists, it is returned as is: no new reservation and no new charge.
- The transaction is stored with a conditional write. When two identical requests race, the loser releases its stock reservation and returns the winner's transaction.
- After a reload during payment, the SPA goes to the result screen and polls that id. A few `404` answers are tolerated while the request is still in flight; after that the customer is told that no charge was made.
- A definitive rejection (for example, out of stock) discards the key, because no transaction was created.

## Consequences
- At most one charge per checkout attempt, whatever the customer does with the browser.
- The card token is still never persisted: reloading before paying asks for the card again.
