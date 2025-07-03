import { IsString, Length } from 'class-validator';

export class TwoFactorDto {
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;
}
