import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import type { Services } from '../app/services';
import { createAppStore, type RootState } from '../app/store';
import { initialCheckoutState, type CheckoutState } from '../features/checkout/checkoutSlice';
import { aProduct, fakeServices, MemoryStorage } from './fakes';

interface Options {
  services?: Services;
  checkout?: Partial<CheckoutState>;
  products?: Partial<RootState['products']>;
}

export const renderWithStore = (ui: ReactElement, options: Options = {}) => {
  const services = options.services ?? fakeServices();
  const store = createAppStore(
    services,
    {
      checkout: { ...initialCheckoutState, ...options.checkout },
      products: { items: [aProduct()], status: 'succeeded', error: null, ...options.products },
    },
    new MemoryStorage(),
  );
  const user = userEvent.setup();
  return { store, services, user, ...render(<Provider store={store}>{ui}</Provider>) };
};
