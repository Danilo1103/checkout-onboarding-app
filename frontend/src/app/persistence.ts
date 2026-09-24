import { initialCheckoutState, type CheckoutState } from '../features/checkout/checkoutSlice';

export const STORAGE_KEY = 'checkout:v1';

const PERSISTED_KEYS = [
  'step',
  'productId',
  'quantity',
  'customer',
  'shipping',
  'card',
  'acceptedTerms',
  'transaction',
  'paymentId',
] as const;

type PersistedCheckout = Pick<CheckoutState, (typeof PERSISTED_KEYS)[number]>;

/** Only non-sensitive progress is stored: never card numbers, CVC or the card token. */
export const toPersisted = (state: CheckoutState): PersistedCheckout =>
  Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]])) as PersistedCheckout;

export const saveCheckout = (state: CheckoutState, storage: Storage = window.localStorage): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(state)));
  } catch {
    // Storage can be full or disabled (private mode); progress is simply not kept.
  }
};

/**
 * Restores progress after a refresh. The card token is never stored, so a
 * customer who reloads on the summary goes back to re-enter the card.
 */
export const loadCheckout = (storage: Storage = window.localStorage): CheckoutState => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initialCheckoutState;
    const saved = JSON.parse(raw) as Partial<PersistedCheckout>;
    const restored: CheckoutState = { ...initialCheckoutState, ...saved };
    if (restored.step === 'summary' && restored.paymentId) {
      // Reloaded while paying: follow that payment instead of asking for the card again.
      return { ...restored, step: 'status' };
    }
    if (restored.step === 'summary') {
      return {
        ...restored,
        step: 'details',
        card: null,
        notice: 'Por seguridad, vuelve a ingresar los datos de tu tarjeta.',
      };
    }
    if (restored.step === 'status' && !restored.transaction && !restored.paymentId) {
      return { ...restored, step: 'product' };
    }
    return restored;
  } catch {
    return initialCheckoutState;
  }
};
