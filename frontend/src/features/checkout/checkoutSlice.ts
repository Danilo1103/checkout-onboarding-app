import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CardSummary, LegalLinks, Quote, Transaction } from '../../api/types';
import type { Services } from '../../app/services';
import type { CardInput } from '../../lib/card';
import type { CustomerInput, ShippingInput } from '../../lib/delivery';

export type Step = 'product' | 'details' | 'summary' | 'status';

export const POLL_INTERVAL_MS = 2_000;
export const MAX_POLLS = 30;

export interface CheckoutState {
  step: Step;
  productId: string | null;
  quantity: number;
  customer: CustomerInput;
  shipping: ShippingInput;
  /** Brand and last digits only; safe to persist. */
  card: Omit<CardSummary, 'token'> | null;
  /** Single-use card token. Kept in memory only, never persisted. */
  cardToken: string | null;
  acceptedTerms: boolean;
  legal: LegalLinks | null;
  quote: Quote | null;
  transaction: Transaction | null;
  status: 'idle' | 'loading' | 'failed';
  error: string | null;
  notice: string | null;
}

export const emptyCustomer: CustomerInput = { email: '', fullName: '', phone: '' };
export const emptyShipping: ShippingInput = {
  recipient: '',
  phone: '',
  addressLine: '',
  city: '',
  region: '',
  postalCode: '',
};

export const initialCheckoutState: CheckoutState = {
  step: 'product',
  productId: null,
  quantity: 1,
  customer: emptyCustomer,
  shipping: emptyShipping,
  card: null,
  cardToken: null,
  acceptedTerms: false,
  legal: null,
  quote: null,
  transaction: null,
  status: 'idle',
  error: null,
  notice: null,
};

type ThunkConfig = { extra: Services; state: { checkout: CheckoutState }; rejectValue: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Ocurrió un error inesperado');

export const submitDetails = createAsyncThunk<
  { card: CardSummary; customer: CustomerInput; shipping: ShippingInput },
  { card: CardInput; customer: CustomerInput; shipping: ShippingInput },
  ThunkConfig
>('checkout/submitDetails', async ({ card, customer, shipping }, { extra, rejectWithValue }) => {
  try {
    return { card: await extra.tokenizeCard(card), customer, shipping };
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

export const loadSummary = createAsyncThunk<{ quote: Quote; legal: LegalLinks }, void, ThunkConfig>(
  'checkout/loadSummary',
  async (_, { extra, getState, rejectWithValue }) => {
    const { productId, quantity } = getState().checkout;
    try {
      const [quote, legal] = await Promise.all([
        extra.api.getQuote(productId!, quantity),
        extra.api.getLegalLinks(),
      ]);
      return { quote, legal };
    } catch (error) {
      return rejectWithValue(messageOf(error));
    }
  },
);

export const pay = createAsyncThunk<Transaction, void, ThunkConfig>(
  'checkout/pay',
  async (_, { extra, getState, rejectWithValue }) => {
    const state = getState().checkout;
    try {
      return await extra.api.createTransaction({
        productId: state.productId!,
        quantity: state.quantity,
        customer: state.customer,
        shipping: state.shipping,
        card: { token: state.cardToken!, brand: state.card!.brand, last4: state.card!.last4, installments: 1 },
        acceptedTerms: state.acceptedTerms,
        acceptedPersonalData: state.acceptedTerms,
      });
    } catch (error) {
      return rejectWithValue(messageOf(error));
    }
  },
);

/** Polls the backend until the gateway reports a final status. Safe to resume after a refresh. */
export const pollTransaction = createAsyncThunk<Transaction, string, ThunkConfig>(
  'checkout/pollTransaction',
  async (id, { extra, rejectWithValue }) => {
    try {
      let transaction = await extra.api.getTransaction(id);
      for (let attempt = 1; transaction.status === 'PENDING' && attempt < MAX_POLLS; attempt += 1) {
        await extra.wait(POLL_INTERVAL_MS);
        transaction = await extra.api.getTransaction(id);
      }
      return transaction;
    } catch (error) {
      return rejectWithValue(messageOf(error));
    }
  },
);

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialCheckoutState,
  reducers: {
    startCheckout: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      state.step = 'details';
      state.productId = action.payload.productId;
      state.quantity = action.payload.quantity;
      state.acceptedTerms = false;
      state.quote = null;
      state.transaction = null;
      state.error = null;
      state.notice = null;
    },
    editDetails: (state) => {
      state.step = 'details';
      state.error = null;
    },
    cancelCheckout: (state) => {
      state.step = 'product';
      state.cardToken = null;
      state.card = null;
      state.error = null;
      state.notice = null;
    },
    setAcceptedTerms: (state, action: PayloadAction<boolean>) => {
      state.acceptedTerms = action.payload;
    },
    finishCheckout: (state) => ({
      ...initialCheckoutState,
      customer: state.customer,
      shipping: state.shipping,
    }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitDetails.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(submitDetails.fulfilled, (state, { payload }) => {
        state.status = 'idle';
        state.step = 'summary';
        state.customer = payload.customer;
        state.shipping = payload.shipping;
        state.card = { brand: payload.card.brand, last4: payload.card.last4 };
        state.cardToken = payload.card.token;
        state.notice = null;
      })
      .addCase(submitDetails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? null;
      })
      .addCase(loadSummary.pending, (state) => {
        state.quote = null;
        state.error = null;
      })
      .addCase(loadSummary.fulfilled, (state, { payload }) => {
        state.quote = payload.quote;
        state.legal = payload.legal;
      })
      .addCase(loadSummary.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(pay.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(pay.fulfilled, (state, { payload }) => {
        state.status = 'idle';
        state.step = 'status';
        state.transaction = payload;
        state.cardToken = null;
      })
      .addCase(pay.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? null;
      })
      .addCase(pollTransaction.fulfilled, (state, { payload }) => {
        state.transaction = payload;
      })
      .addCase(pollTransaction.rejected, (state, action) => {
        state.error = action.payload ?? null;
      });
  },
});

export const { startCheckout, editDetails, cancelCheckout, setAcceptedTerms, finishCheckout } = checkoutSlice.actions;
export default checkoutSlice.reducer;
