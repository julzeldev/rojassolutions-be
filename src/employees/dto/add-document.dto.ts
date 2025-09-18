import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class AddDocumentDto {
  @ApiProperty({ example: 'Contrato firmado.pdf' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string;

  @ApiProperty({ example: 'https://example.com/files/contrato.pdf' })
  @IsUrl({ require_protocol: true })
  url: string;

  @ApiProperty({ required: false, example: 'Contratos' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;
}
