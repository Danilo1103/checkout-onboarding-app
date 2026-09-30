export interface Fees {
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
  /** VAT rate applied to the product price only (fees are exempt). */
  readonly vatRatePercent: number;
}

export interface Amounts {
  readonly productInCents: number;
  readonly vatInCents: number;
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
  readonly totalInCents: number;
}

export const CURRENCY = 'COP';

export const calculateVat = (
  productInCents: number,
  vatRatePercent: number,
): number => Math.round((productInCents * vatRatePercent) / 100);

export const calculateAmounts = (
  unitPriceInCents: number,
  quantity: number,
  fees: Fees,
): Amounts => {
  const productInCents = unitPriceInCents * quantity;
  const vatInCents = calculateVat(productInCents, fees.vatRatePercent);
  return {
    productInCents,
    vatInCents,
    baseFeeInCents: fees.baseFeeInCents,
    deliveryFeeInCents: fees.deliveryFeeInCents,
    totalInCents:
      productInCents +
      vatInCents +
      fees.baseFeeInCents +
      fees.deliveryFeeInCents,
  };
};
