# 001 – Card tokenization in the browser

**Status:** accepted

## Context
The checkout needs card data to charge the customer. Handling raw card numbers on our servers widens the attack surface and brings PCI DSS obligations.

## Decision
The frontend sends card number, CVC, expiry and holder name directly to the gateway's `POST /tokens/cards` endpoint using the **public** key. Our backend only receives the resulting single-use token, the card brand and the last four digits.

## Consequences
- The backend never receives, stores or logs sensitive card data.
- The private key, integrity secret and events secret stay on the server.
- Card data lives only in component memory and is never persisted in the Redux store or `localStorage`.
