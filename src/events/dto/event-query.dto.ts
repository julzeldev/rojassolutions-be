import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum, IsMongoId } from 'class-validator';
import { EventType, PredefinedEventType } from '../schemas/event.schema';

export class EventQueryDto {
  @ApiProperty({
    required: false,
    example: '2025-11-01',
    description: 'Filter events from this date',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    required: false,
    example: '2025-11-30',
    description: 'Filter events until this date',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    required: false,
    enum: EventType,
    description: 'Filter by event type',
  })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiProperty({
    required: false,
    enum: PredefinedEventType,
    description: 'Filter by predefined event type',
  })
  @IsOptional()
  @IsEnum(PredefinedEventType)
  predefinedType?: PredefinedEventType;

  @ApiProperty({
    required: false,
    description: 'Filter events for specific employee',
  })
  @IsOptional()
  @IsMongoId()
  employeeId?: string;
}
