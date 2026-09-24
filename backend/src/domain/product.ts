export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly priceInCents: number;
  readonly stock: number;
  readonly reserved: number;
}

export const availableUnits = (product: Product): number =>
  Math.max(product.stock - product.reserved, 0);
