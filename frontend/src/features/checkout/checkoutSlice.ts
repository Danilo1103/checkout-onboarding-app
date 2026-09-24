import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CardSummary, LegalLinks, Quote, Transaction } from '../../api/types';
import { ApiError } from '../../api/http';
import type { Services } from '../../app/services';
import type { CardInput } from '../../lib/card';
import type { CustomerInput, ShippingInput } from '../../lib/delivery';

export type Step = 'product' | 'details' | 'summary' | 'status';

export const POLL_INTERVAL_MS = 2_000;
export const MAX_POLLS = 30;
/** After a reload the create request may still be in flight; tolerate a few 404s. */
export const MAX_NOT_FOUND = 5;

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
  /** Idempotency key of the payment being processed; persisted to survive reloads. */
  paymentId: string | null;
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
  paymentId: null,
  status: 'idle',
  error: null,
  notice: null,
};

type BaseThunkConfig = { extra: Services; state: { checkout: CheckoutState } };
type ThunkConfig = BaseThunkConfig & { rejectValue: string };

/** The payment may or may not exist when the request failed before a definitive answer. */
const outcomeUnknown = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 0 || error.status >= 500;

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

export const pay = createAsyncThunk<
  Transaction,
  void,
  BaseThunkConfig & { rejectValue: { message: string; outcomeUnknown: boolean } }
>('checkout/pay', async (_, { extra, getState, dispatch, rejectWithValue }) => {
  const state = getState().checkout;
  // Reuse the key on retries so the backend never charges twice.
  const paymentId = state.paymentId ?? extra.newId();
  dispatch(paymentStarted(paymentId));
  try {
    return await extra.api.createTransaction({
      idempotencyKey: paymentId,
      productId: state.productId!,
      quantity: state.quantity,
      customer: state.customer,
      shipping: state.shipping,
      card: { token: state.cardToken!, brand: state.card!.brand, last4: state.card!.last4, installments: 1 },
      acceptedTerms: state.acceptedTerms,
      acceptedPersonalData: state.acceptedTerms,
    });
  } catch (error) {
    return rejectWithValue({ message: messageOf(error), outcomeUnknown: outcomeUnknown(error) });
  }
});

/** Polls the backend until the gateway reports a final status. Safe to resume after a refresh. */
export const pollTransaction = createAsyncThunk<Transaction, string, ThunkConfig>(
  'checkout/pollTransaction',
  async (id, { extra, rejectWithValue }) => {
    let notFound = 0;
    try {
      for (let attempt = 1; ; attempt += 1) {
        let transaction: Transaction | null = null;
        try {
          transaction = await extra.api.getTransaction(id);
        } catch (error) {
          const missing = error instanceof ApiError && error.status === 404;
          if (!missing) throw error;
          notFound += 1;
          if (notFound >= MAX_NOT_FOUND) {
            return rejectWithValue('No encontramos este pago, así que no se realizó ningún cobro.');
          }
        }
        if (transaction && (transaction.status !== 'PENDING' || attempt >= MAX_POLLS)) return transaction;
        await extra.wait(POLL_INTERVAL_MS);
      }
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
      state.paymentId = null;
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
    paymentStarted: (state, action: PayloadAction<string>) => {
      state.paymentId = action.payload;
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
        state.error = action.payload?.message ?? null;
        // A definitive rejection means no transaction was created: the next try gets a new key.
        if (!action.payload?.outcomeUnknown) state.paymentId = null;
      })
      .addCase(pollTransaction.pending, (state) => {
        state.error = null;
      })
      .addCase(pollTransaction.fulfilled, (state, { payload }) => {
        state.transaction = payload;
      })
      .addCase(pollTransaction.rejected, (state, action) => {
        state.error = action.payload ?? null;
      });
  },
});

export const { startCheckout, editDetails, cancelCheckout, paymentStarted, setAcceptedTerms, finishCheckout } =
  checkoutSlice.actions;
export default checkoutSlice.reducer;
