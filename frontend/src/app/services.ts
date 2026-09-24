import { tokenizeCard, type TokenizeCard } from '../api/cardTokenizer';
import { checkoutApi, type CheckoutApi } from '../api/checkoutApi';

/** Side effects available to thunks; replaced by fakes in tests. */
export interface Services {
  api: CheckoutApi;
  tokenizeCard: TokenizeCard;
  wait: (ms: number) => Promise<void>;
}

export const defaultServices: Services = {
  api: checkoutApi,
  tokenizeCard,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
