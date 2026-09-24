import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/ui/Button';
import { CardBrandLogo } from '../../../components/ui/CardBrandLogo';
import { Modal } from '../../../components/ui/Modal';
import { TextField } from '../../../components/ui/TextField';
import {
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  validateCard,
  type CardInput,
} from '../../../lib/card';
import { validateCustomer, validateShipping, type CustomerInput, type ShippingInput } from '../../../lib/delivery';
import { cancelCheckout, submitDetails } from '../checkoutSlice';
import { CardPreview } from './CardPreview';
import { StepIndicator } from './StepIndicator';
import styles from './CheckoutModal.module.css';

type Touched = Record<string, boolean>;

const emptyCard: CardInput = { number: '', holder: '', expiry: '', cvc: '' };

export function CheckoutModal() {
  const dispatch = useAppDispatch();
  const checkout = useAppSelector((state) => state.checkout);
  const [card, setCard] = useState<CardInput>(emptyCard);
  const [customer, setCustomer] = useState<CustomerInput>(checkout.customer);
  const [shipping, setShipping] = useState<ShippingInput>(checkout.shipping);
  const [touched, setTouched] = useState<Touched>({});

  const cardErrors = validateCard(card);
  const customerErrors = validateCustomer(customer);
  const shippingErrors = validateShipping(shipping);
  const show = (key: string, message?: string) => (touched[key] ? message : undefined);
  const blur = (key: string) => () => setTouched((current) => ({ ...current, [key]: true }));

  const onCard = (key: keyof CardInput) => (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const value =
      key === 'number' ? formatCardNumber(raw) : key === 'expiry' ? formatExpiry(raw) : key === 'cvc' ? digitsOnly(raw).slice(0, 4) : raw;
    setCard((current) => ({ ...current, [key]: value }));
  };
  const onCustomer = (key: keyof CustomerInput) => (event: ChangeEvent<HTMLInputElement>) =>
    setCustomer((current) => ({ ...current, [key]: event.target.value }));
  const onShipping = (key: keyof ShippingInput) => (event: ChangeEvent<HTMLInputElement>) =>
    setShipping((current) => ({ ...current, [key]: event.target.value }));

  const hasErrors = [cardErrors, customerErrors, shippingErrors].some((errors) => Object.keys(errors).length > 0);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (hasErrors) {
      const all = [
        ...Object.keys(emptyCard).map((k) => `card.${k}`),
        ...Object.keys(customer).map((k) => `customer.${k}`),
        ...Object.keys(shipping).map((k) => `shipping.${k}`),
      ];
      setTouched(Object.fromEntries(all.map((k) => [k, true])));
      return;
    }
    void dispatch(submitDetails({ card, customer, shipping }));
  };

  const loading = checkout.status === 'loading';

  return (
    <Modal
      title="Datos de pago y entrega"
      onClose={() => dispatch(cancelCheckout())}
      footer={
        <Button type="submit" form="checkout-form" block loading={loading}>
          {loading ? 'Validando tarjeta…' : 'Continuar al resumen'}
        </Button>
      }
    >
      <StepIndicator current={1} />
      {checkout.notice && (
        <p className={styles.notice} role="status">
          {checkout.notice}
        </p>
      )}
      <form id="checkout-form" className={styles.form} onSubmit={onSubmit} noValidate>
        <fieldset className={styles.section}>
          <legend>Tarjeta de crédito</legend>
          <CardPreview number={card.number} holder={card.holder} expiry={card.expiry} />
          <TextField
            label="Número de tarjeta"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={card.number}
            onChange={onCard('number')}
            onBlur={blur('card.number')}
            error={show('card.number', cardErrors.number)}
            adornment={<CardBrandLogo brand={detectBrand(card.number)} size={36} />}
          />
          <TextField
            label="Nombre del titular"
            autoComplete="cc-name"
            placeholder="Como aparece en la tarjeta"
            value={card.holder}
            onChange={onCard('holder')}
            onBlur={blur('card.holder')}
            error={show('card.holder', cardErrors.holder)}
          />
          <div className={styles.row}>
            <TextField
              label="Vence"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={card.expiry}
              onChange={onCard('expiry')}
              onBlur={blur('card.expiry')}
              error={show('card.expiry', cardErrors.expiry)}
            />
            <TextField
              label="CVC"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              type="password"
              value={card.cvc}
              onChange={onCard('cvc')}
              onBlur={blur('card.cvc')}
              error={show('card.cvc', cardErrors.cvc)}
            />
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Contacto</legend>
          <TextField label="Correo electrónico" type="email" autoComplete="email" value={customer.email} onChange={onCustomer('email')} onBlur={blur('customer.email')} error={show('customer.email', customerErrors.email)} />
          <TextField label="Nombre completo" autoComplete="name" value={customer.fullName} onChange={onCustomer('fullName')} onBlur={blur('customer.fullName')} error={show('customer.fullName', customerErrors.fullName)} />
          <TextField label="Celular" type="tel" inputMode="tel" autoComplete="tel" value={customer.phone} onChange={onCustomer('phone')} onBlur={blur('customer.phone')} error={show('customer.phone', customerErrors.phone)} />
        </fieldset>

        <fieldset className={styles.section}>
          <legend>Dirección de entrega</legend>
          <TextField label="Quién recibe" autoComplete="shipping name" value={shipping.recipient} onChange={onShipping('recipient')} onBlur={blur('shipping.recipient')} error={show('shipping.recipient', shippingErrors.recipient)} />
          <TextField label="Teléfono de quien recibe" type="tel" inputMode="tel" value={shipping.phone} onChange={onShipping('phone')} onBlur={blur('shipping.phone')} error={show('shipping.phone', shippingErrors.phone)} />
          <TextField label="Dirección" autoComplete="shipping address-line1" value={shipping.addressLine} onChange={onShipping('addressLine')} onBlur={blur('shipping.addressLine')} error={show('shipping.addressLine', shippingErrors.addressLine)} />
          <div className={styles.row}>
            <TextField label="Ciudad" autoComplete="shipping address-level2" value={shipping.city} onChange={onShipping('city')} onBlur={blur('shipping.city')} error={show('shipping.city', shippingErrors.city)} />
            <TextField label="Departamento" autoComplete="shipping address-level1" value={shipping.region} onChange={onShipping('region')} onBlur={blur('shipping.region')} error={show('shipping.region', shippingErrors.region)} />
          </div>
          <TextField label="Código postal" inputMode="numeric" autoComplete="shipping postal-code" value={shipping.postalCode} onChange={onShipping('postalCode')} onBlur={blur('shipping.postalCode')} error={show('shipping.postalCode', shippingErrors.postalCode)} />
        </fieldset>

        {checkout.error && (
          <p className={styles.error} role="alert">
            {checkout.error}
          </p>
        )}
        <p className={styles.hint}>Tu tarjeta se procesa directamente con la pasarela de pagos. No la guardamos.</p>
      </form>
    </Modal>
  );
}
