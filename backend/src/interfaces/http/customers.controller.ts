import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UpsertCustomer } from '../../application/use-cases/upsert-customer';
import { CustomerDto } from './dto/create-transaction.dto';
import { unwrap } from './result-to-http';
import { USE_CASES } from './tokens';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(
    @Inject(USE_CASES.upsertCustomer)
    private readonly upsertCustomer: UpsertCustomer,
  ) {}

  @Post()
  upsert(@Body() body: CustomerDto) {
    return unwrap(this.upsertCustomer.execute(body));
  }
}
