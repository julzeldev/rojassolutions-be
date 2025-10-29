import { IsString, Length } from 'class-validator';

export class RegenRecoveryCodesDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
