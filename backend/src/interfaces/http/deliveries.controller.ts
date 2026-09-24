import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetDelivery } from '../../application/use-cases/get-delivery';
import { unwrap } from './result-to-http';
import { USE_CASES } from './tokens';

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    @Inject(USE_CASES.getDelivery) private readonly getDelivery: GetDelivery,
  ) {}

  @Get(':transactionId')
  get(@Param('transactionId', new ParseUUIDPipe()) transactionId: string) {
    return unwrap(this.getDelivery.execute(transactionId));
  }
}
