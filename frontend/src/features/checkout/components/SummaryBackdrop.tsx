import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/ui/Button';
import { CardBrandLogo } from '../../../components/ui/CardBrandLogo';
import { Skeleton } from '../../../components/ui/Skeleton';
import { SmartImage } from '../../../components/ui/SmartImage';
import { formatCOP } from '../../../lib/money';
import { editDetails, loadSummary, pay, setAcceptedTerms } from '../checkoutSlice';
import { StepIndicator } from './StepIndicator';
import styles from './SummaryBackdrop.module.css';

/**
 * Backdrop component (Material Design): the back layer keeps the product in
 * context while the front layer shows the payment summary.
 */
export function SummaryBackdrop() {
  const dispatch = useAppDispatch();
  const checkout = useAppSelector((state) => state.checkout);
  const product = useAppSelector((state) => state.products.items.find((p) => p.id === checkout.productId));
  const { quote, legal, card, shipping, acceptedTerms, status, error } = checkout;
  const paying = status === 'loading';

  useEffect(() => {
    void dispatch(loadSummary());
  }, [dispatch]);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div className={styles.backLayer}>
        {product && <SmartImage src={product.imageUrl} alt="" sizes="72px" className={styles.thumb} />}
        <div>
          <p className={styles.eyebrow}>Estás comprando</p>
          <p className={styles.productName}>
            {checkout.quantity} × {product?.name ?? 'Producto'}
          </p>
        </div>
        <Button variant="ghost" className={styles.edit} onClick={() => dispatch(editDetails())} disabled={paying}>
          Editar
        </Button>
      </div>

      <section className={styles.frontLayer}>
        <StepIndicator current={2} />
        <h2 id="summary-title" className={styles.title}>
          Resumen del pago
        </h2>

        <dl className={styles.lines} aria-busy={!quote}>
          {quote ? (
            <>
              <div>
                <dt>Producto ({quote.quantity})</dt>
                <dd>{formatCOP(quote.amounts.productInCents)}</dd>
              </div>
              <div>
                <dt>Tarifa base</dt>
                <dd>{formatCOP(quote.amounts.baseFeeInCents)}</dd>
              </div>
              <div>
                <dt>Envío</dt>
                <dd>{formatCOP(quote.amounts.deliveryFeeInCents)}</dd>
              </div>
              <div className={styles.total}>
                <dt>Total</dt>
                <dd>{formatCOP(quote.amounts.totalInCents)}</dd>
              </div>
            </>
          ) : (
            [0, 1, 2, 3].map((key) => (
              <div key={key} data-testid="summary-skeleton">
                <Skeleton width="40%" />
                <Skeleton width="25%" />
              </div>
            ))
          )}
        </dl>

        <div className={styles.details}>
          {card && (
            <p className={styles.detail}>
              <CardBrandLogo brand={card.brand} size={32} />
              <span>Tarjeta terminada en {card.last4}</span>
            </p>
          )}
          <p className={styles.detail}>
            <span aria-hidden="true">📦</span>
            <span>
              {shipping.addressLine}, {shipping.city}
            </span>
          </p>
        </div>

        <label className={styles.terms}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => dispatch(setAcceptedTerms(event.target.checked))}
          />
          <span>
            Acepto el{' '}
            <a href={legal?.termsUrl} target="_blank" rel="noopener noreferrer">
              reglamento de uso
            </a>{' '}
            y la{' '}
            <a href={legal?.personalDataUrl} target="_blank" rel="noopener noreferrer">
              autorización de tratamiento de datos
            </a>{' '}
            de la pasarela de pagos.
          </span>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button block loading={paying} disabled={!quote || !acceptedTerms} onClick={() => void dispatch(pay())}>
          {paying ? 'Procesando…' : quote ? `Pagar ${formatCOP(quote.amounts.totalInCents)}` : 'Pagar'}
        </Button>
      </section>
    </div>
  );
}
