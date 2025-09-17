import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({ example: 'Perez' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lastName: string;

  // Accept yyyy/mm/dd as string
  @ApiProperty({ example: '1985/03/25', description: 'yyyy/mm/dd' })
  @IsString()
  @Matches(/^\d{4}\/\d{2}\/\d{2}$/)
  dob: string;

  @ApiProperty({ example: '2020/01/15', description: 'yyyy/mm/dd' })
  @IsString()
  @Matches(/^\d{4}\/\d{2}\/\d{2}$/)
  dateOfHire: string;

  @ApiProperty({ example: '012345678', description: '9 digits' })
  @IsString()
  @Matches(/^\d{9}$/)
  documentId: string;

  @ApiProperty({ required: false, enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
