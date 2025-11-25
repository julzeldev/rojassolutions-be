import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  MaxLength,
  Matches,
  IsMongoId,
} from 'class-validator';
import {
  PredefinedEventType,
  EventType,
  EventStatus,
} from '../schemas/event.schema';

export class CreateEventDto {
  @ApiProperty({ example: 'Reunión con cliente', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    required: false,
    example: 'Discutir detalles del nuevo proyecto',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    enum: EventType,
    default: EventType.CUSTOM,
    example: EventType.PREDEFINED,
  })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ example: '2025-11-15', description: 'ISO 8601 date format' })
  @IsDateString()
  eventDate: string;

  @ApiProperty({ required: false, example: '09:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @ApiProperty({ required: false, example: '17:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @ApiProperty({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiProperty({
    required: false,
    description: 'Employee ID for birthday events',
  })
  @IsOptional()
  @IsMongoId()
  employeeId?: string;

  @ApiProperty({
    enum: PredefinedEventType,
    default: PredefinedEventType.CUSTOM,
    example: PredefinedEventType.INCAPACIDAD,
  })
  @IsOptional()
  @IsEnum(PredefinedEventType)
  predefinedType?: PredefinedEventType;

  @ApiProperty({
    required: false,
    example: '#f44336',
    description: 'Hex color code',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color code',
  })
  color?: string;

  @ApiProperty({ enum: EventStatus, default: EventStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
