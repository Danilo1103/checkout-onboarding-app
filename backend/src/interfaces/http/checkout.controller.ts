import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetAcceptanceTokens } from '../../application/use-cases/get-acceptance-tokens';
import { GetCheckoutQuote } from '../../application/use-cases/get-checkout-quote';
import { QuoteQueryDto } from './dto/create-transaction.dto';
import { unwrap } from './result-to-http';
import { USE_CASES } from './tokens';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(
    @Inject(USE_CASES.getQuote) private readonly getQuote: GetCheckoutQuote,
    @Inject(USE_CASES.getAcceptance)
    private readonly getAcceptance: GetAcceptanceTokens,
  ) {}

  /** Amounts are always computed on the server; the client only displays them. */
  @Get('quote')
  quote(@Query() query: QuoteQueryDto) {
    return unwrap(this.getQuote.execute(query.productId, query.quantity));
  }

  /** Links to the documents the customer must accept before paying. */
  @Get('acceptance')
  async acceptance() {
    const tokens = await unwrap(this.getAcceptance.execute());
    return {
      termsUrl: tokens.termsUrl,
      personalDataUrl: tokens.personalDataUrl,
    };
  }
}
