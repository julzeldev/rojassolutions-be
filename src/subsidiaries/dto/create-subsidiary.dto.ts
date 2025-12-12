import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Length,
  Matches,
  ValidateNested,
  IsEmail,
  IsIn,
  IsObject,
  IsUrl,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubsidiaryContactDto {
  @ApiPropertyOptional({ example: 'Juan Pérez', maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({ example: 'sucursal@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '88888888', pattern: '^\\d{8}$' })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Phone must be 8 digits' })
  phone?: string;
}

export class SubsidiaryAddressDto {
  @ApiProperty({ example: 'San José', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  province: string;

  @ApiPropertyOptional({ example: 'Central', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  canton?: string;
}

export class CreateSubsidiaryDto {
  @ApiProperty({ example: 'Sucursal Centro', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string;

  @ApiProperty({ type: SubsidiaryAddressDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => SubsidiaryAddressDto)
  address: SubsidiaryAddressDto;

  @ApiPropertyOptional({ type: SubsidiaryContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SubsidiaryContactDto)
  contact?: SubsidiaryContactDto;

  @ApiProperty({
    example: 'https://www.google.com/maps/place/Ciudad+Toyota/@9.9525625,-84.1107624,17z',
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsUrl({}, { message: 'Must be a valid URL' })
  @Length(1, 1000)
  googleMapsUrl: string;

  @ApiPropertyOptional({ example: 9.9525625, minimum: -90, maximum: 90 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -84.1107624, minimum: -180, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Inventory object (TBD)' })
  @IsOptional()
  @IsObject()
  inventory?: Record<string, any>;

  @ApiPropertyOptional({ example: 'Notes about this subsidiary', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
