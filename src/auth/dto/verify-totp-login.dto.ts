import { IsString, Length } from 'class-validator';

export class VerifyTotpLoginDto {
  @IsString()
  userId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
