const formatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Amounts travel in cents; the UI shows whole pesos. */
export const formatCOP = (cents: number): string => formatter.format(Math.round(cents / 100));
