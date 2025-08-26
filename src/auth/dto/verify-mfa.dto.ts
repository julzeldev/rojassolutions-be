import { IsString, Length, IsIn, IsOptional } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  userId!: string;

  @IsString()
  @Length(6, 6)
  token!: string;

  @IsOptional()
  @IsIn(['enable', 'login'])
  purpose?: 'enable' | 'login';
}
