export interface Fees {
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
}

export interface Amounts {
  readonly productInCents: number;
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
  readonly totalInCents: number;
}

export const CURRENCY = 'COP';

export const calculateAmounts = (
  unitPriceInCents: number,
  quantity: number,
  fees: Fees,
): Amounts => {
  const productInCents = unitPriceInCents * quantity;
  return {
    productInCents,
    baseFeeInCents: fees.baseFeeInCents,
    deliveryFeeInCents: fees.deliveryFeeInCents,
    totalInCents:
      productInCents + fees.baseFeeInCents + fees.deliveryFeeInCents,
  };
};
