import { IsEmail, IsString, Length } from 'class-validator';

export class RecoveryLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 64)
  recoveryCode!: string;
}
