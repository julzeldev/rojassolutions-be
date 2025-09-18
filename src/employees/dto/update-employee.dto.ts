import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ example: 'Juan' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Perez' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({ example: '1985/03/25', description: 'yyyy/mm/dd' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}\/\d{2}\/\d{2}$/)
  dob?: string;

  @ApiPropertyOptional({ example: '2020/01/15', description: 'yyyy/mm/dd' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}\/\d{2}\/\d{2}$/)
  dateOfHire?: string;

  @ApiPropertyOptional({ example: '012345678', description: '9 digits' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  documentId?: string;

  @ApiPropertyOptional({ example: '88889999', description: '8 digits' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/)
  phone?: string;

  @ApiPropertyOptional({ example: 'juan.perez@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
