import { ShippingInfo } from './delivery';
import { CardBrand } from './transaction';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?\d{7,15}$/;
const LAST4 = /^\d{4}$/;
const POSTAL = /^\d{4,10}$/;

export const MAX_QUANTITY = 5;
export const CARD_BRANDS: readonly CardBrand[] = [
  'VISA',
  'MASTERCARD',
  'UNKNOWN',
];

const required = (
  value: string | undefined,
  field: string,
  errors: string[],
): void => {
  if (!value || value.trim().length === 0) errors.push(`${field} is required`);
};

export const validateEmail = (email: string): string[] =>
  EMAIL.test(email) ? [] : ['email must be a valid email address'];

export const validatePhone = (phone: string, field = 'phone'): string[] =>
  PHONE.test(phone) ? [] : [`${field} must contain 7 to 15 digits`];

export const validateQuantity = (quantity: number): string[] =>
  Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY
    ? []
    : [`quantity must be an integer between 1 and ${MAX_QUANTITY}`];

export const validateShipping = (shipping: ShippingInfo): string[] => {
  const errors: string[] = [];
  required(shipping.recipient, 'shipping.recipient', errors);
  required(shipping.addressLine, 'shipping.addressLine', errors);
  required(shipping.city, 'shipping.city', errors);
  required(shipping.region, 'shipping.region', errors);
  errors.push(...validatePhone(shipping.phone, 'shipping.phone'));
  if (!POSTAL.test(shipping.postalCode))
    errors.push('shipping.postalCode must contain 4 to 10 digits');
  return errors;
};

export const validateCardSummary = (
  brand: CardBrand,
  last4: string,
): string[] => {
  const errors: string[] = [];
  if (!CARD_BRANDS.includes(brand)) errors.push('card.brand is not supported');
  if (!LAST4.test(last4)) errors.push('card.last4 must contain 4 digits');
  return errors;
};
