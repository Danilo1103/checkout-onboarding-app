import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetProduct } from '../../application/use-cases/get-product';
import { ListProducts } from '../../application/use-cases/list-products';
import { unwrap } from './result-to-http';
import { USE_CASES } from './tokens';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(USE_CASES.listProducts) private readonly listProducts: ListProducts,
    @Inject(USE_CASES.getProduct) private readonly getProduct: GetProduct,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Products with the units available to buy' })
  list() {
    return this.listProducts.execute();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return unwrap(this.getProduct.execute(id));
  }
}
