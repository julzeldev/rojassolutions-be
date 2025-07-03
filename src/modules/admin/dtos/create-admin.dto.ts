import {
  IsString,
  IsEmail,
  MinLength,
  Matches,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { AdminStatus } from '../schemas/admin.schema';

export class CreateAdminDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEmail()
  email: string;

  /**
   * Social Security Number (9 digits, no separators)
   * Adjust the regex if you want to allow dashes (e.g. 123-45-6789)
   */
  @IsString()
  @Matches(/^\d{9}$/, { message: 'ssn must be exactly 9 digits' })
  ssn: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  password: string;

  /**
   * Optional: you can allow setting status on creation,
   * otherwise it will default to ACTIVE.
   */
  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;
}
