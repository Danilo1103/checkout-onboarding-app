import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/ui/Button';
import { SmartImage } from '../../../components/ui/SmartImage';
import { formatCOP } from '../../../lib/money';
import { pollTransaction } from '../checkoutSlice';
import { StepIndicator } from './StepIndicator';
import styles from './StatusScreen.module.css';

interface StatusScreenProps {
  onFinish: () => void;
}

const COPY = {
  APPROVED: { icon: '✓', title: '¡Pago aprobado!', text: 'Tu pedido está confirmado y ya asignamos la entrega.', tone: styles.success },
  DECLINED: { icon: '✕', title: 'Pago rechazado', text: 'Tu banco no aprobó el pago. No se hizo ningún cobro.', tone: styles.danger },
  VOIDED: { icon: '✕', title: 'Pago anulado', text: 'La transacción fue anulada. No se hizo ningún cobro.', tone: styles.danger },
  ERROR: { icon: '!', title: 'No pudimos procesar el pago', text: 'Ocurrió un problema con la pasarela. Intenta de nuevo.', tone: styles.danger },
} as const;

export function StatusScreen({ onFinish }: StatusScreenProps) {
  const dispatch = useAppDispatch();
  const transaction = useAppSelector((state) => state.checkout.transaction);
  const paymentId = useAppSelector((state) => state.checkout.paymentId);
  const pollError = useAppSelector((state) => state.checkout.error);
  const productId = useAppSelector((state) => transaction?.productId ?? state.checkout.productId);
  const product = useAppSelector((state) => state.products.items.find((p) => p.id === productId));
  // After a reload during payment only the payment id is known until the first poll answers.
  const id = transaction?.id ?? paymentId!;
  const pending = !transaction || transaction.status === 'PENDING';

  useEffect(() => {
    if (pending) void dispatch(pollTransaction(id));
    // Poll once per transaction; the thunk keeps polling until a final status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  if (!transaction && pollError) {
    return (
      <section className={styles.screen} aria-live="polite">
        <div className={styles.panel}>
          <StepIndicator current={3} outcome="failed" />
          <span className={[styles.icon, styles.danger].join(' ')} aria-hidden="true">
            !
          </span>
          <h1 className={styles.title}>No pudimos confirmar el pago</h1>
          <p className={styles.text}>{pollError}</p>
          <Button block variant="secondary" onClick={() => void dispatch(pollTransaction(id))}>
            Consultar de nuevo
          </Button>
          <Button block onClick={onFinish}>
            Volver a la tienda
          </Button>
        </div>
      </section>
    );
  }

  if (pending) {
    return (
      <section className={styles.screen} aria-live="polite">
        <div className={styles.panel}>
          <StepIndicator current={3} />
          <span className={styles.spinner} aria-hidden="true" />
          <h1 className={styles.title}>Procesando tu pago</h1>
          <p className={styles.text}>Estamos confirmando con tu banco. No cierres esta ventana.</p>
          {pollError && (
            <Button variant="secondary" onClick={() => void dispatch(pollTransaction(id))}>
              Consultar de nuevo
            </Button>
          )}
        </div>
      </section>
    );
  }

  const copy = COPY[transaction.status as Exclude<typeof transaction.status, 'PENDING'>];
  return (
    <section className={styles.screen} aria-live="polite">
      <div className={styles.panel}>
        <StepIndicator current={3} outcome={transaction.status === 'APPROVED' ? 'success' : 'failed'} />
        <span className={[styles.icon, copy.tone].join(' ')} aria-hidden="true">
          {copy.icon}
        </span>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.text}>{copy.text}</p>
        <div className={styles.receipt}>
          <div className={styles.product}>
            {product && <SmartImage src={product.imageUrl} alt="" sizes="64px" className={styles.thumb} />}
            <div className={styles.productInfo}>
              <p className={styles.productName}>{product?.name ?? 'Producto'}</p>
              <p className={styles.productQty}>
                {transaction.quantity} × {formatCOP(transaction.amounts.productInCents / transaction.quantity)}
              </p>
            </div>
          </div>
          <dl className={styles.lines}>
          <div>
            <dt>Referencia</dt>
            <dd>{transaction.reference}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatCOP(transaction.amounts.totalInCents)}</dd>
          </div>
          <div>
            <dt>Tarjeta</dt>
            <dd>
              {transaction.card.brand} •••• {transaction.card.last4}
            </dd>
          </div>
          </dl>
        </div>
        <Button block onClick={onFinish}>
          Volver a la tienda
        </Button>
      </div>
    </section>
  );
}
