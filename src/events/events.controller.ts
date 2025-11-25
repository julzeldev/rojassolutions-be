import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles('admin')
  create(@Body() createEventDto: CreateEventDto, @Req() req: Request) {
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid session');
    }
    return this.eventsService.create(createEventDto, userId);
  }

  @Get()
  @Roles('admin')
  findAll(@Query() query: EventQueryDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid session');
    }
    return this.eventsService.update(id, updateEventDto, userId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Get('birthdays/upcoming')
  @Roles('admin')
  getUpcomingBirthdays(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.eventsService.getUpcomingBirthdays(daysNum);
  }

  @Get('statistics')
  @Roles('admin')
  getStatistics() {
    return this.eventsService.getEventStatistics();
  }
}
