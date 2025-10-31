import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class AddSalaryDto {
  @ApiProperty({
    example: 55000000,
    description: 'Amount in CRC cents. 550000.00 CRC => 55000000',
  })
  @IsInt()
  @Min(0)
  amountCents: number;

  @ApiProperty({ example: 'CRC', enum: ['CRC'], default: 'CRC' })
  @IsString()
  @IsIn(['CRC'])
  currency: string = 'CRC';

  @ApiProperty({
    required: false,
    enum: ['monthly', 'biweekly', 'weekly', 'hourly'],
  })
  @IsOptional()
  @IsIn(['monthly', 'biweekly', 'weekly', 'hourly'])
  schedule?: 'monthly' | 'biweekly' | 'weekly' | 'hourly';

  @ApiProperty({
    example: '2025-01-01',
    description: 'Start date (yyyy-mm-dd) for this salary to become effective',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveFrom: string;

  @ApiProperty({ required: false, example: 'Initial salary set' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
