import { useState } from 'react';
import type { Product } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { QuantityStepper } from '../../../components/ui/QuantityStepper';
import { SmartImage } from '../../../components/ui/SmartImage';
import { formatCOP } from '../../../lib/money';
import styles from './ProductCard.module.css';

export const MAX_PER_ORDER = 5;

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  onBuy: (productId: string, quantity: number) => void;
}

const stockLabel = (units: number) => {
  if (units === 0) return { text: 'Agotado', tone: styles.out };
  if (units === 1) return { text: '¡Última unidad!', tone: styles.low };
  if (units <= 3) return { text: `¡Últimas ${units} unidades!`, tone: styles.low };
  return { text: `${units} disponibles`, tone: styles.ok };
};

export function ProductCard({ product, priority, onBuy }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const max = Math.min(product.availableUnits, MAX_PER_ORDER);
  const stock = stockLabel(product.availableUnits);
  const soldOut = product.availableUnits === 0;

  return (
    <article className={styles.card} aria-labelledby={`product-${product.id}`}>
      <SmartImage src={product.imageUrl} alt={product.name} priority={priority} className={styles.image} />
      <div className={styles.body}>
        <span className={[styles.stock, stock.tone].join(' ')}>{stock.text}</span>
        <h2 id={`product-${product.id}`} className={styles.name}>
          {product.name}
        </h2>
        <p className={styles.description}>{product.description}</p>
        <p className={styles.price}>{formatCOP(product.priceInCents)}</p>
        <div className={styles.actions}>
          {!soldOut && (
            <div className={styles.quantity}>
              <span>Cantidad</span>
              <QuantityStepper
                value={Math.min(quantity, max)}
                max={max}
                onChange={setQuantity}
                label={`Cantidad de ${product.name}`}
              />
            </div>
          )}
          <Button
            block
            disabled={soldOut}
            onClick={() => onBuy(product.id, Math.min(quantity, max))}
            icon={<span aria-hidden="true">💳</span>}
          >
            {soldOut ? 'Sin unidades' : 'Pagar con tarjeta de crédito'}
          </Button>
        </div>
      </div>
    </article>
  );
}
