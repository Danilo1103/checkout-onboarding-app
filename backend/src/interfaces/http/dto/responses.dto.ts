import { ApiProperty } from '@nestjs/swagger';

/** Response shapes for the OpenAPI document. Amounts are integers in cents. */
export class AmountsDto {
  @ApiProperty({ example: 34_990_000 })
  readonly productInCents: number;

  @ApiProperty({
    example: 6_648_100,
    description: 'VAT (19% by default) applied to the product price only',
  })
  readonly vatInCents: number;

  @ApiProperty({ example: 500_000 })
  readonly baseFeeInCents: number;

  @ApiProperty({ example: 1_000_000 })
  readonly deliveryFeeInCents: number;

  @ApiProperty({
    example: 43_138_100,
    description: 'Product + VAT + base fee + delivery fee',
  })
  readonly totalInCents: number;
}

export class QuoteResponseDto {
  @ApiProperty({ example: 'prod-headphones' })
  readonly productId: string;

  @ApiProperty({ example: 1 })
  readonly quantity: number;

  @ApiProperty({ example: 'COP' })
  readonly currency: string;

  @ApiProperty({ type: AmountsDto })
  readonly amounts: AmountsDto;
}

class CardSummaryResponseDto {
  @ApiProperty({ enum: ['VISA', 'MASTERCARD', 'UNKNOWN'] })
  readonly brand: string;

  @ApiProperty({ example: '4242' })
  readonly last4: string;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ example: 'TX-3f1c...' })
  readonly reference: string;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] })
  readonly status: string;

  @ApiProperty({ example: 'prod-headphones' })
  readonly productId: string;

  @ApiProperty({ example: 1 })
  readonly quantity: number;

  @ApiProperty({ example: 'COP' })
  readonly currency: string;

  @ApiProperty({ type: AmountsDto })
  readonly amounts: AmountsDto;

  @ApiProperty({ type: CardSummaryResponseDto })
  readonly card: CardSummaryResponseDto;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt: string;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt: string;
}
