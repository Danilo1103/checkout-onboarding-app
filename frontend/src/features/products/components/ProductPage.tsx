import { useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/ui/Button';
import { ProductCard } from './ProductCard';
import { ProductSkeleton } from './ProductSkeleton';
import styles from './ProductPage.module.css';

interface ProductPageProps {
  onBuy: (productId: string, quantity: number) => void;
  onRetry: () => void;
}

export function ProductPage({ onBuy, onRetry }: ProductPageProps) {
  const { items, status, error } = useAppSelector((state) => state.products);
  const loading = status === 'idle' || (status === 'loading' && items.length === 0);

  return (
    <section className={styles.page} aria-labelledby="catalog-title">
      <div className={styles.intro}>
        <h1 id="catalog-title">Tecnología que te acompaña</h1>
        <p>Paga con tarjeta de crédito VISA o Mastercard y recibe en tu casa.</p>
      </div>

      {status === 'failed' ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className={styles.grid} aria-busy={loading}>
          {loading
            ? [0, 1, 2].map((key) => <ProductSkeleton key={key} />)
            : items.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index === 0} onBuy={onBuy} />
              ))}
        </div>
      )}
    </section>
  );
}
