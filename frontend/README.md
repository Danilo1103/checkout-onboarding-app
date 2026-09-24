# Frontend

React 19 + TypeScript single page app built with Vite. State is managed with Redux Toolkit following the Flux pattern. Styles are hand-written CSS modules on top of design tokens.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server on http://localhost:5173 |
| `pnpm build` | Type check and production build into `dist/` |
| `pnpm test` / `pnpm test:cov` | Jest + React Testing Library (coverage threshold 80%) |
| `pnpm lint` | Oxlint |

## Configuration

Local values come from `frontend/.env.local` (see the root `.env.example`):

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL, e.g. `http://localhost:3000/api` |
| `VITE_PAYMENT_API_URL` | Payment gateway sandbox base URL (card tokenization) |
| `VITE_PAYMENT_PUBLIC_KEY` | Payment gateway **public** key |

In AWS the same build reads `/config.json`, written at deploy time ([`src/runtimeConfig.ts`](src/runtimeConfig.ts)).

## Structure

```
src/
  api/          HTTP client, backend endpoints, card tokenization with the public key
  app/          store, typed hooks, injectable services, localStorage persistence
  features/
    products/   catalog slice and product page (cards, skeletons, quantity)
    checkout/   checkout slice and screens: card & delivery modal, summary backdrop, status
  components/
    layout/     header
    ui/         design system: Button, TextField, Modal, Skeleton, SmartImage, QuantityStepper,
                CardBrandLogo, useLockedViewport
  lib/          card (Luhn, brand, formatting), delivery validation, money formatting
  test/         fakes, render helper and test configuration
```

## Checkout state

The `checkout` slice drives the 5-step flow with a single `step` field:

```
product → details (modal) → summary (backdrop) → status → product
```

| Thunk | What it does |
|---|---|
| `submitDetails` | Tokenizes the card with the gateway and moves to the summary |
| `loadSummary` | Loads the server-side quote and the legal links |
| `pay` | Generates or reuses the idempotency key and creates the transaction |
| `pollTransaction` | Polls the backend until a final status, tolerating a few 404s after a reload |

Side effects (API, tokenization, waits, id generation) are injected through `app/services.ts`, so every thunk is tested without network calls.

## Persistence and security

- Progress is saved in `localStorage` (`checkout:v1`): step, product, quantity, contact and delivery data, card brand and last four digits, transaction and idempotency key.
- The card number, CVC and the card token are **never** stored. Reloading before paying asks for the card again; reloading after pressing *Pay* resumes that payment.

## UI notes

- Mobile first, tested from 375×667. The checkout form is a bottom sheet on phones and a right side sheet on tablets and desktops.
- `useLockedViewport` locks the page behind sheets (iOS) and keeps the focused field above the on-screen keyboard.
- Product images are WebP (360 px and 720 px) served with `srcset`, a reserved aspect ratio and a skeleton until they load.
- Accessibility: labelled fields with inline errors, focus trap and Escape in dialogs, step states announced to screen readers, `prefers-reduced-motion` respected.
