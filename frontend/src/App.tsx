import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { Header } from './components/layout/Header';
import { finishCheckout, startCheckout } from './features/checkout/checkoutSlice';
import { CheckoutModal } from './features/checkout/components/CheckoutModal';
import { StatusScreen } from './features/checkout/components/StatusScreen';
import { SummaryBackdrop } from './features/checkout/components/SummaryBackdrop';
import { ProductPage } from './features/products/components/ProductPage';
import { fetchProducts } from './features/products/productsSlice';

function App() {
  const dispatch = useAppDispatch();
  const step = useAppSelector((state) => state.checkout.step);

  const loadProducts = useCallback(() => void dispatch(fetchProducts()), [dispatch]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const onBuy = (productId: string, quantity: number) => dispatch(startCheckout({ productId, quantity }));

  const onFinish = () => {
    dispatch(finishCheckout());
    loadProducts();
  };

  return (
    <>
      <Header />
      <main>
        {step === 'status' ? <StatusScreen onFinish={onFinish} /> : <ProductPage onBuy={onBuy} onRetry={loadProducts} />}
      </main>
      {step === 'details' && <CheckoutModal />}
      {step === 'summary' && <SummaryBackdrop />}
    </>
  );
}

export default App;
