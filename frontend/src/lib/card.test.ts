import {
  detectBrand,
  formatCardNumber,
  formatExpiry,
  parseExpiry,
  passesLuhn,
  validateCard,
} from './card';

const now = new Date('2026-09-24T00:00:00Z');
const valid = { number: '4242 4242 4242 4242', holder: 'Ana Gomez', expiry: '12/29', cvc: '123' };

describe('card utilities', () => {
  it('detects VISA and Mastercard ranges', () => {
    expect(detectBrand('4242')).toBe('VISA');
    expect(detectBrand('5555 5555')).toBe('MASTERCARD');
    expect(detectBrand('2223 0000')).toBe('MASTERCARD');
    expect(detectBrand('3782')).toBe('UNKNOWN');
    expect(detectBrand('')).toBe('UNKNOWN');
  });

  it('validates the Luhn checksum', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('4111111111111111')).toBe(true);
    expect(passesLuhn('4242424242424241')).toBe(false);
    expect(passesLuhn('4242')).toBe(false);
  });

  it('formats the number and the expiry while typing', () => {
    expect(formatCardNumber('4242424242424242999')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('42a42')).toBe('4242');
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('1229')).toBe('12/29');
    expect(parseExpiry('12/29')).toEqual({ month: '12', year: '29' });
    expect(parseExpiry('1229')).toBeNull();
  });

  it('accepts a valid card', () => {
    expect(validateCard(valid, now)).toEqual({});
  });

  it('reports every invalid field', () => {
    expect(validateCard({ number: '1234', holder: 'Ana', expiry: '13/30', cvc: '1' }, now)).toEqual({
      number: 'Número de tarjeta inválido',
      holder: 'Escribe el nombre como aparece en la tarjeta',
      expiry: 'Usa el formato MM/AA',
      cvc: 'CVC de 3 o 4 dígitos',
    });
  });

  it('rejects unsupported brands and expired cards', () => {
    expect(validateCard({ ...valid, number: '6011 1111 1111 1117' }, now).number).toBe(
      'Solo aceptamos VISA y Mastercard',
    );
    expect(validateCard({ ...valid, expiry: '08/26' }, now).expiry).toBe('La tarjeta está vencida');
    expect(validateCard({ ...valid, expiry: '09/26' }, now)).toEqual({});
  });
});
