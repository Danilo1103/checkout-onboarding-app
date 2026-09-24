import { availableUnits, Product } from '../../domain/product';
import { ProductRepository } from '../ports/repositories';

export interface ProductView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly priceInCents: number;
  readonly availableUnits: number;
}

export const toProductView = (product: Product): ProductView => ({
  id: product.id,
  name: product.name,
  description: product.description,
  imageUrl: product.imageUrl,
  priceInCents: product.priceInCents,
  availableUnits: availableUnits(product),
});

export class ListProducts {
  constructor(private readonly products: ProductRepository) {}

  async execute(): Promise<ProductView[]> {
    const products = await this.products.findAll();
    return products.map(toProductView);
  }
}
