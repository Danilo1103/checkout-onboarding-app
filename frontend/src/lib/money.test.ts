import { formatCOP } from './money';

it('formats cents as Colombian pesos', () => {
  expect(formatCOP(34_990_000).replace(/\s/g, ' ')).toBe('$ 349.900');
});
