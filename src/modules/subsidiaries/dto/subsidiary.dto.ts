import {
  IsString,
  IsOptional,
  IsMongoId,
  IsArray,
  IsNumber,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsString()
  type: 'Point';

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: number[]; // [longitude, latitude]
}

export class ContactDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;
}

export class CreateSubsidiaryDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  mapsUrl?: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @IsOptional()
  @IsMongoId()
  supervisorId?: string;
}

export class UpdateSubsidiaryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  mapsUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @IsOptional()
  @IsMongoId()
  supervisorId?: string;
}
