import { combineReducers, configureStore } from '@reduxjs/toolkit';
import checkoutReducer from '../features/checkout/checkoutSlice';
import productsReducer from '../features/products/productsSlice';
import { loadCheckout, saveCheckout } from './persistence';
import { defaultServices, type Services } from './services';

const rootReducer = combineReducers({ products: productsReducer, checkout: checkoutReducer });

export type RootState = ReturnType<typeof rootReducer>;

export const createAppStore = (
  services: Services = defaultServices,
  preloadedState?: Partial<RootState>,
  storage?: Storage,
) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState ?? { checkout: loadCheckout(storage) },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: services } }),
  });
  let previous = store.getState().checkout;
  store.subscribe(() => {
    const { checkout } = store.getState();
    if (checkout !== previous) {
      previous = checkout;
      saveCheckout(checkout, storage);
    }
  });
  return store;
};

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
