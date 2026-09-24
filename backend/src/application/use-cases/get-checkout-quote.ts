import { Amounts, calculateAmounts, CURRENCY } from '../../domain/pricing';
import { availableUnits } from '../../domain/product';
import {
  DomainError,
  notFound,
  outOfStock,
  validationError,
} from '../../domain/shared/errors';
import { err, ok, ResultAsync } from '../../domain/shared/result';
import { validateQuantity } from '../../domain/validation';
import { ProductRepository } from '../ports/repositories';
import { CheckoutFees } from '../ports/system';

export interface Quote {
  readonly productId: string;
  readonly quantity: number;
  readonly currency: string;
  readonly amounts: Amounts;
}

export class GetCheckoutQuote {
  constructor(
    private readonly products: ProductRepository,
    private readonly fees: CheckoutFees,
  ) {}

  execute(
    productId: string,
    quantity: number,
  ): ResultAsync<Quote, DomainError> {
    return ResultAsync.from(validateQuantityStep(quantity))
      .andThen(async () => {
        const product = await this.products.findById(productId);
        return product
          ? ok(product)
          : err(notFound(`Product ${productId} not found`));
      })
      .andThen((product) =>
        availableUnits(product) >= quantity
          ? ok(product)
          : err(outOfStock(`Only ${availableUnits(product)} units available`)),
      )
      .map((product) => ({
        productId,
        quantity,
        currency: CURRENCY,
        amounts: calculateAmounts(product.priceInCents, quantity, this.fees),
      }));
  }
}

const validateQuantityStep = (quantity: number) => {
  const errors = validateQuantity(quantity);
  return errors.length === 0
    ? ok(quantity)
    : err(validationError('Invalid quantity', errors));
};
