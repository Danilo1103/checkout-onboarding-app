import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateTransaction } from '../../application/use-cases/create-transaction';
import { SyncTransaction } from '../../application/use-cases/sync-transaction';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { presentTransaction } from './presenters';
import { unwrap } from './result-to-http';
import { USE_CASES } from './tokens';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(USE_CASES.createTransaction)
    private readonly createTransaction: CreateTransaction,
    @Inject(USE_CASES.syncTransaction)
    private readonly syncTransaction: SyncTransaction,
  ) {}

  /** Reserves stock, creates a PENDING transaction and charges the tokenized card. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Body() body: CreateTransactionDto) {
    return presentTransaction(
      await unwrap(this.createTransaction.execute(body)),
    );
  }

  /** Current status; while PENDING it is refreshed from the payment gateway. */
  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return presentTransaction(await unwrap(this.syncTransaction.execute(id)));
  }
}
