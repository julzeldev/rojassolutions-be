import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SeedEmployeesDto {
  @ApiProperty({
    required: false,
    default: false,
    description: 'Si es true, elimina todos los empleados antes de sembrar',
  })
  @IsOptional()
  @IsBoolean()
  clearExisting?: boolean;
}
