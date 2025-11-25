import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument, EventType } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { Employee } from '../employees/schemas/employee.schema';

interface EmployeeForBirthday {
  _id: Types.ObjectId;
  firstName: string;
  firstLastName: string;
  secondLastName?: string;
  dob: Date;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Employee.name) private employeeModel: Model<Employee>,
  ) {}

  async create(dto: CreateEventDto, userId: string): Promise<EventDocument> {
    // Validate birthday events
    if (dto.type === EventType.BIRTHDAY && !dto.employeeId) {
      throw new BadRequestException(
        'employeeId is required for birthday events',
      );
    }

    const created = await this.eventModel.create({
      ...dto,
      createdBy: new Types.ObjectId(userId),
      employeeId: dto.employeeId
        ? new Types.ObjectId(dto.employeeId)
        : undefined,
    });

    return created;
  }

  async findAll(query: EventQueryDto): Promise<EventDocument[]> {
    const filter: Record<string, any> = {};

    // Date range filtering
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) {
        dateFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        dateFilter.$lte = new Date(query.endDate);
      }
      filter.eventDate = dateFilter;
    }

    // Type filtering
    if (query.type) {
      filter.type = query.type;
    }

    // Predefined type filtering
    if (query.predefinedType) {
      filter.predefinedType = query.predefinedType;
    }

    // Employee filtering
    if (query.employeeId) {
      filter.employeeId = new Types.ObjectId(query.employeeId);
    }

    // Auto-generate birthday events for the date range if we have dates
    if (query.startDate && query.endDate) {
      await this.syncBirthdayEventsForDateRange(
        new Date(query.startDate),
        new Date(query.endDate),
      );
    }

    return this.eventModel
      .find(filter)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .populate('employeeId', 'firstName firstLastName secondLastName dob')
      .sort({ eventDate: 1 })
      .exec();
  }

  async findOne(id: string): Promise<EventDocument> {
    const event = await this.eventModel
      .findById(id)
      .populate('createdBy', 'email')
      .populate('lastModifiedBy', 'email')
      .populate('employeeId', 'firstName firstLastName secondLastName dob')
      .exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    userId: string,
  ): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Prevent editing birthday events
    if (event.type === EventType.BIRTHDAY) {
      throw new BadRequestException('Birthday events cannot be edited');
    }

    const updated = await this.eventModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          lastModifiedBy: new Types.ObjectId(userId),
          employeeId: dto.employeeId
            ? new Types.ObjectId(dto.employeeId)
            : event.employeeId,
        },
        { new: true },
      )
      .populate('createdBy', 'email')
      .populate('lastModifiedBy', 'email')
      .populate('employeeId', 'firstName firstLastName secondLastName dob')
      .exec();

    if (!updated) {
      throw new NotFoundException('Event not found');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Prevent deleting birthday events
    if (event.type === EventType.BIRTHDAY) {
      throw new BadRequestException('Birthday events cannot be deleted');
    }

    await this.eventModel.findByIdAndDelete(id).exec();
  }

  async getBirthdayEvents(
    employees: EmployeeForBirthday[],
    year: number,
    systemUserId: string,
  ): Promise<EventDocument[]> {
    const birthdayEvents: EventDocument[] = [];

    for (const employee of employees) {
      if (!employee.dob) continue;

      const dob = new Date(employee.dob);
      const birthdayThisYear = new Date(
        Date.UTC(year, dob.getUTCMonth(), dob.getUTCDate(), 0, 0, 0),
      );

      const fullName = `${employee.firstName} ${employee.firstLastName}${employee.secondLastName ? ' ' + employee.secondLastName : ''}`;

      // Check if birthday event already exists for this employee and year
      const existing = await this.eventModel
        .findOne({
          type: EventType.BIRTHDAY,
          employeeId: employee._id,
          eventDate: birthdayThisYear,
        })
        .exec();

      if (!existing) {
        // Create birthday event
        const birthdayEvent = await this.eventModel.create({
          title: `🎂 Cumpleaños: ${fullName}`,
          description: `Cumpleaños de ${fullName}`,
          type: EventType.BIRTHDAY,
          eventDate: birthdayThisYear,
          allDay: true,
          employeeId: employee._id,
          color: '#2196f3', // Blue color for birthdays
          status: 'active',
          createdBy: new Types.ObjectId(systemUserId),
        });

        birthdayEvents.push(birthdayEvent);
      } else {
        birthdayEvents.push(existing);
      }
    }

    return birthdayEvents;
  }

  async getUpcomingBirthdays(days: number = 30): Promise<EventDocument[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    return this.eventModel
      .find({
        type: EventType.BIRTHDAY,
        eventDate: {
          $gte: today,
          $lte: futureDate,
        },
      })
      .populate('employeeId', 'firstName firstLastName secondLastName dob')
      .sort({ eventDate: 1 })
      .exec();
  }

  /**
   * Sync birthday events for all employees within a date range
   */
  private async syncBirthdayEventsForDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Get all active employees
    const employees = await this.employeeModel
      .find({ status: 'active' })
      .select('_id firstName firstLastName secondLastName dob')
      .exec();

    if (!employees || employees.length === 0) {
      return;
    }

    // Get unique years in the date range
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const years = new Set<number>();
    
    for (let year = startYear; year <= endYear; year++) {
      years.add(year);
    }

    // Get system user ID (use first admin or create a system placeholder)
    // For now, we'll use the first user we can find or a placeholder ObjectId
    const systemUser = await this.employeeModel.findOne().select('_id').exec();
    const systemUserId =
      systemUser?._id?.toString() || '000000000000000000000000';

    // Generate birthday events for each year
    for (const year of years) {
      const employeesForBirthday = employees.map((emp) => ({
        _id: emp._id,
        firstName: emp.firstName,
        firstLastName: emp.firstLastName,
        secondLastName: emp.secondLastName,
        dob: emp.dob,
      }));

      await this.getBirthdayEvents(employeesForBirthday, year, systemUserId);
    }
  }

  async getEventStatistics(): Promise<{
    total: number;
    byType: Array<{ type: string; count: number }>;
    byPredefinedType: Array<{ predefinedType: string; count: number }>;
    upcoming: number;
    thisMonth: number;
  }> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [total, byType, byPredefinedType, upcoming, thisMonth] =
      await Promise.all([
        // Total events
        this.eventModel.countDocuments().exec(),

        // By type
        this.eventModel
          .aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $project: { type: '$_id', count: 1, _id: 0 } },
          ])
          .exec(),

        // By predefined type
        this.eventModel
          .aggregate([
            { $match: { type: EventType.PREDEFINED } },
            { $group: { _id: '$predefinedType', count: { $sum: 1 } } },
            { $project: { predefinedType: '$_id', count: 1, _id: 0 } },
          ])
          .exec(),

        // Upcoming events (next 30 days)
        this.eventModel
          .countDocuments({
            eventDate: {
              $gte: today,
              $lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          })
          .exec(),

        // Events this month
        this.eventModel
          .countDocuments({
            eventDate: {
              $gte: startOfMonth,
              $lte: endOfMonth,
            },
          })
          .exec(),
      ]);

    return {
      total,
      byType: byType as Array<{ type: string; count: number }>,
      byPredefinedType: byPredefinedType as Array<{
        predefinedType: string;
        count: number;
      }>,
      upcoming,
      thisMonth,
    };
  }
}
