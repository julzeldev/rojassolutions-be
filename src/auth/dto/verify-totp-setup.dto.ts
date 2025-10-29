import { IsString, Length } from 'class-validator';

export class VerifyTotpSetupDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
