import { validateCustomer, validateShipping } from './delivery';

describe('delivery validation', () => {
  it('accepts valid customer and shipping data', () => {
    expect(validateCustomer({ email: 'ana@example.com', fullName: 'Ana Gomez', phone: '3001234567' })).toEqual({});
    expect(
      validateShipping({
        recipient: 'Ana Gomez',
        phone: '+573001234567',
        addressLine: 'Calle 10 # 43-12',
        city: 'Medellín',
        region: 'Antioquia',
        postalCode: '050021',
      }),
    ).toEqual({});
  });

  it('reports every invalid field', () => {
    expect(Object.keys(validateCustomer({ email: 'x', fullName: 'A', phone: '1' }))).toEqual([
      'email',
      'fullName',
      'phone',
    ]);
    expect(
      Object.keys(
        validateShipping({ recipient: '', phone: '', addressLine: '', city: ' ', region: '', postalCode: 'abc' }),
      ),
    ).toEqual(['recipient', 'phone', 'addressLine', 'city', 'region', 'postalCode']);
  });
});
