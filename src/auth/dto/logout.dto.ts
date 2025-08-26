import { IsString, Length } from 'class-validator';

export class LogoutDto {
  @IsString()
  @Length(10, 1024)
  refreshToken!: string;
}
