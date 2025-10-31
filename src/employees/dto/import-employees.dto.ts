import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEmployeeDto } from './create-employee.dto';

export enum ImportStrategy {
  SKIP = 'skip', // Skip duplicates, only add new
  UPDATE = 'update', // Update existing, add new
  REPLACE = 'replace', // Delete all and import
}

export class ImportEmployeesDto {
  @ApiProperty({
    type: [CreateEmployeeDto],
    description: 'Array of employees to import',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  employees: CreateEmployeeDto[];

  @ApiProperty({
    enum: ImportStrategy,
    default: ImportStrategy.SKIP,
    description: 'Strategy for handling existing employees',
  })
  @IsOptional()
  @IsEnum(ImportStrategy)
  strategy?: ImportStrategy;
}
