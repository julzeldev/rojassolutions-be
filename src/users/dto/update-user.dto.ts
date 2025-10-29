import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MfaRecoveryCodeDto {
  @IsString()
  codeHash: string;

  @IsString()
  codeEnc: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  usedAt?: Date | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(['admin', 'employee'])
  role?: 'admin' | 'employee';

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @IsOptional()
  @IsString()
  mfaSecret?: string;

  @IsOptional()
  @IsString()
  mfaSecretEnc?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MfaRecoveryCodeDto)
  mfaRecoveryCodes?: MfaRecoveryCodeDto[];

  @IsOptional()
  @IsBoolean()
  recoveryCodesShownOnce?: boolean;
}
