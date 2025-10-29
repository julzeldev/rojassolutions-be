import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

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
  mfaEnabled?: boolean;

  @IsOptional()
  @IsString()
  mfaSecret?: string;

  @IsOptional()
  mfaSecretEnc?: string;

  @IsOptional()
  mfaRecoveryCodes?: {
    codeHash: string;
    codeEnc: string;
    usedAt?: Date | null;
  }[];

  @IsOptional()
  @IsBoolean()
  recoveryCodesShownOnce?: boolean;
}
