import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { Product } from '../../api/types';
import type { Services } from '../../app/services';

export interface ProductsState {
  items: Product[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ProductsState = { items: [], status: 'idle', error: null };

export const fetchProducts = createAsyncThunk<Product[], void, { extra: Services }>(
  'products/fetch',
  (_, { extra }) => extra.api.getProducts(),
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'No pudimos cargar los productos';
      });
  },
});

export default productsSlice.reducer;
