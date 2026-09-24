export type CardBrand = 'VISA' | 'MASTERCARD' | 'UNKNOWN';

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

export const detectBrand = (cardNumber: string): CardBrand => {
  const digits = digitsOnly(cardNumber);
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720))/.test(digits)) return 'MASTERCARD';
  return 'UNKNOWN';
};

/** Luhn checksum used by every card network to catch typos. */
export const passesLuhn = (cardNumber: string): boolean => {
  const digits = digitsOnly(cardNumber);
  if (digits.length < 13) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

export const formatCardNumber = (value: string): string =>
  digitsOnly(value)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

/** Formats as MM/YY while typing. */
export const formatExpiry = (value: string): string => {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

export const parseExpiry = (value: string): { month: string; year: string } | null => {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  return match ? { month: match[1], year: match[2] } : null;
};

export interface CardInput {
  number: string;
  holder: string;
  expiry: string;
  cvc: string;
}

export type CardErrors = Partial<Record<keyof CardInput, string>>;

export const validateCard = (card: CardInput, now: Date = new Date()): CardErrors => {
  const errors: CardErrors = {};
  const digits = digitsOnly(card.number);
  if (digits.length !== 16 || !passesLuhn(digits)) errors.number = 'Número de tarjeta inválido';
  else if (detectBrand(digits) === 'UNKNOWN') errors.number = 'Solo aceptamos VISA y Mastercard';

  if (card.holder.trim().length < 5) errors.holder = 'Escribe el nombre como aparece en la tarjeta';

  const expiry = parseExpiry(card.expiry);
  const month = expiry ? Number(expiry.month) : 0;
  if (!expiry || month < 1 || month > 12) {
    errors.expiry = 'Usa el formato MM/AA';
  } else {
    const expiresAt = new Date(2000 + Number(expiry.year), month, 1);
    if (expiresAt <= now) errors.expiry = 'La tarjeta está vencida';
  }

  if (!/^\d{3,4}$/.test(card.cvc)) errors.cvc = 'CVC de 3 o 4 dígitos';
  return errors;
};
