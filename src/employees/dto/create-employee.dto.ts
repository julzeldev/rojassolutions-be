import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
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

  @ApiProperty({
    example: '1985-03-25',
    description: 'yyyy-mm-dd (ISO format)',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dob must be in yyyy-mm-dd format',
  })
  dob: string;

  @ApiProperty({
    example: '2020-01-15',
    description: 'yyyy-mm-dd (ISO format)',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfHire must be in yyyy-mm-dd format',
  })
  dateOfHire: string;

  @ApiProperty({ example: '012345678', description: '9 digits' })
  @IsString()
  @Length(9, 9)
  @Matches(/^\d{9}$/, { message: 'documentId must be 9 digits' })
  documentId: string;

  @ApiProperty({ example: '88889999', description: '8 digits' })
  @IsString()
  @Length(8, 8)
  @Matches(/^\d{8}$/, { message: 'phone must be 8 digits' })
  phone: string;

  @ApiProperty({ required: false, example: 'juan.perez@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({ required: false, enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
