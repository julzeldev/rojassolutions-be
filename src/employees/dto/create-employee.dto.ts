import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @ApiProperty({ required: false, example: 'San José' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  province?: string;

  @ApiProperty({ required: false, example: 'Central' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  canton?: string;

  @ApiProperty({ required: false, example: 'Carmen' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  district?: string;

  @ApiProperty({ required: false, example: 'Calle 5, Avenida 3' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  exactAddress?: string;
}

export class EmergencyContactDto {
  @ApiProperty({ required: false, example: 'María Pérez' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiProperty({
    required: false,
    example: '88887777',
    description: '8 digits',
  })
  @IsOptional()
  @IsString()
  @Length(8, 8)
  @Matches(/^\d{8}$/, { message: 'phone must be 8 digits' })
  phone?: string;

  @ApiProperty({ required: false, example: 'Madre' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  relationship?: string;
}

export class CreateEmployeeDto {
  // Identification
  @ApiProperty({
    example: '012345678',
    description: 'Identificación - 9 digits',
  })
  @IsString()
  @Length(9, 9)
  @Matches(/^\d{9}$/, { message: 'documentId must be 9 digits' })
  documentId: string;

  // Name fields
  @ApiProperty({ example: 'Juan', description: 'Nombre' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido 1' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstLastName: string;

  @ApiProperty({
    required: false,
    example: 'González',
    description: 'Apellido 2',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  secondLastName?: string;

  // Personal Information
  @ApiProperty({
    required: false,
    example: 'Costarricense',
    description: 'Nacionalidad',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  nationality?: string;

  @ApiProperty({
    example: '1985-03-25',
    description: 'Fecha de nacimiento - yyyy-mm-dd (ISO format)',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dob must be in yyyy-mm-dd format',
  })
  dob: string;

  @ApiProperty({
    required: false,
    enum: ['single', 'married', 'divorced', 'widowed', 'free_union'],
    description: 'Estado Civil',
  })
  @IsOptional()
  @IsIn(['single', 'married', 'divorced', 'widowed', 'free_union'])
  maritalStatus?: string;

  @ApiProperty({
    required: false,
    example: 'Universitaria',
    description: 'Escolaridad',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  education?: string;

  // Contact Information
  @ApiProperty({ example: '88889999', description: 'Teléfono - 8 digits' })
  @IsString()
  @Length(8, 8)
  @Matches(/^\d{8}$/, { message: 'phone must be 8 digits' })
  phone: string;

  @ApiProperty({
    required: false,
    example: 'juan.perez@example.com',
    description: 'Correo Electrónico',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({ required: false, type: AddressDto, description: 'Domicilio' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  // Emergency Contact
  @ApiProperty({
    required: false,
    type: EmergencyContactDto,
    description: 'Contacto de Emergencia',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  // Work Information
  @ApiProperty({
    example: '2020-01-15',
    description: 'Ingreso a la empresa - yyyy-mm-dd (ISO format)',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfHire must be in yyyy-mm-dd format',
  })
  dateOfHire: string;

  @ApiProperty({
    required: false,
    example: 'Desarrollador',
    description: 'Puesto',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  position?: string;

  @ApiProperty({ required: false, enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  // Uniform/Clothing
  @ApiProperty({ required: false, example: 'M', description: 'Talla Camisa' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  shirtSize?: string;

  @ApiProperty({
    required: false,
    example: '42',
    description: 'Número de Calzado',
  })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  shoeSize?: string;

  // Financial Information
  @ApiProperty({
    required: false,
    example: 'CR12345678901234567890',
    description: 'Número de cuenta',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  bankAccount?: string;

  // Additional Information
  @ApiProperty({
    required: false,
    example: 'Notas adicionales',
    description: 'Observaciones',
  })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
