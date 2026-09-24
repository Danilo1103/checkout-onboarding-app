import { calculateAmounts } from './pricing';
import { availableUnits } from './product';
import { isFinal } from './transaction';
import {
  validateCardSummary,
  validateEmail,
  validatePhone,
  validateQuantity,
  validateShipping,
} from './validation';
import { aProduct, aShipping } from '../test-utils/in-memory';

describe('domain', () => {
  it('calculates amounts in cents including fees', () => {
    expect(
      calculateAmounts(10_000, 2, {
        baseFeeInCents: 500,
        deliveryFeeInCents: 1_000,
      }),
    ).toEqual({
      productInCents: 20_000,
      baseFeeInCents: 500,
      deliveryFeeInCents: 1_000,
      totalInCents: 21_500,
    });
  });

  it('computes available units and never returns negative values', () => {
    expect(availableUnits(aProduct({ stock: 5, reserved: 2 }))).toBe(3);
    expect(availableUnits(aProduct({ stock: 1, reserved: 3 }))).toBe(0);
  });

  it('knows which statuses are final', () => {
    expect(isFinal('PENDING')).toBe(false);
    expect(isFinal('APPROVED')).toBe(true);
    expect(isFinal('DECLINED')).toBe(true);
  });

  it('validates emails, phones and quantities', () => {
    expect(validateEmail('ana@example.com')).toEqual([]);
    expect(validateEmail('ana@')).toHaveLength(1);
    expect(validatePhone('+573001234567')).toEqual([]);
    expect(validatePhone('12')).toEqual(['phone must contain 7 to 15 digits']);
    expect(validateQuantity(1)).toEqual([]);
    expect(validateQuantity(0)).toHaveLength(1);
    expect(validateQuantity(1.5)).toHaveLength(1);
  });

  it('validates shipping information', () => {
    expect(validateShipping(aShipping())).toEqual([]);
    const errors = validateShipping(
      aShipping({
        recipient: ' ',
        addressLine: '',
        city: '',
        region: '',
        phone: 'x',
        postalCode: 'abc',
      }),
    );
    expect(errors).toEqual([
      'shipping.recipient is required',
      'shipping.addressLine is required',
      'shipping.city is required',
      'shipping.region is required',
      'shipping.phone must contain 7 to 15 digits',
      'shipping.postalCode must contain 4 to 10 digits',
    ]);
  });

  it('validates the card summary', () => {
    expect(validateCardSummary('VISA', '4242')).toEqual([]);
    expect(validateCardSummary('AMEX' as never, '42')).toEqual([
      'card.brand is not supported',
      'card.last4 must contain 4 digits',
    ]);
  });
});
