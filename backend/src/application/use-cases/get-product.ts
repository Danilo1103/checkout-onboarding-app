import { DomainError, notFound } from '../../domain/shared/errors';
import { err, ok, Result } from '../../domain/shared/result';
import { ProductRepository } from '../ports/repositories';
import { ProductView, toProductView } from './list-products';

export class GetProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(id: string): Promise<Result<ProductView, DomainError>> {
    const product = await this.products.findById(id);
    return product
      ? ok(toProductView(product))
      : err(notFound(`Product ${id} not found`));
  }
}
