import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsEnum(['admin', 'employee'])
  role?: 'admin' | 'employee';
}
