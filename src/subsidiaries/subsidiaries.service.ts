import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subsidiary, SubsidiaryDocument } from './schemas/subsidiary.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { CreateSubsidiaryDto } from './dto/create-subsidiary.dto';
import { UpdateSubsidiaryDto } from './dto/update-subsidiary.dto';
import { SubsidiaryQueryDto } from './dto/subsidiary-query.dto';

@Injectable()
export class SubsidiariesService {
  constructor(
    @InjectModel(Subsidiary.name)
    private subsidiaryModel: Model<SubsidiaryDocument>,
    @InjectModel(Employee.name)
    private employeeModel: Model<EmployeeDocument>,
  ) {}

  async create(dto: CreateSubsidiaryDto): Promise<SubsidiaryDocument> {
    try {
      const created = await this.subsidiaryModel.create({
        name: dto.name.trim(),
        address: dto.address,
        contact: dto.contact,
        googleMapsUrl: dto.googleMapsUrl.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        inventory: dto.inventory,
        notes: dto.notes?.trim(),
        status: dto.status ?? 'active',
      });

      return created;
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (e?.code === 11000) {
        if (e?.keyPattern?.name) {
          throw new ConflictException(
            'A subsidiary with this name already exists',
          );
        }
        throw new ConflictException('Duplicate entry');
      }
      throw err;
    }
  }

  async findAll(query: SubsidiaryQueryDto): Promise<{
    items: SubsidiaryDocument[];
    total: number;
  }> {
    const { q, status, limit: limitStr, offset: offsetStr } = query;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const filter: Record<string, any> = {};

    if (status) {
      filter.status = status;
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [{ name: regex }];
    }

    const [items, total] = await Promise.all([
      this.subsidiaryModel
        .find(filter)
        .sort({ name: 1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.subsidiaryModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<SubsidiaryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid subsidiary ID');
    }

    const subsidiary = await this.subsidiaryModel.findById(id).exec();

    if (!subsidiary) {
      throw new NotFoundException('Subsidiary not found');
    }

    return subsidiary;
  }

  async update(
    id: string,
    dto: UpdateSubsidiaryDto,
  ): Promise<SubsidiaryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid subsidiary ID');
    }

    const update: Partial<Subsidiary> = {};

    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.address !== undefined) update.address = dto.address;
    if (dto.contact !== undefined) update.contact = dto.contact;
    if (dto.googleMapsUrl !== undefined) update.googleMapsUrl = dto.googleMapsUrl.trim();
    if (dto.latitude !== undefined) update.latitude = dto.latitude;
    if (dto.longitude !== undefined) update.longitude = dto.longitude;
    if (dto.inventory !== undefined) update.inventory = dto.inventory;
    if (dto.notes !== undefined) update.notes = dto.notes?.trim();
    if (dto.status !== undefined) update.status = dto.status;

    try {
      const updated = await this.subsidiaryModel
        .findByIdAndUpdate(id, update, { new: true })
        .exec();

      if (!updated) {
        throw new NotFoundException('Subsidiary not found');
      }

      return updated;
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (e?.code === 11000) {
        if (e?.keyPattern?.name) {
          throw new ConflictException(
            'A subsidiary with this name already exists',
          );
        }
        throw new ConflictException('Duplicate entry');
      }
      throw err;
    }
  }

  async remove(id: string, options?: { hard?: boolean }): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid subsidiary ID');
    }

    const { hard = false } = options || {};

    // Check if any employees are assigned to this subsidiary
    const employeeCount = await this.employeeModel
      .countDocuments({ subsidiaryId: new Types.ObjectId(id) })
      .exec();

    if (employeeCount > 0 && hard) {
      throw new BadRequestException(
        `Cannot delete subsidiary with ${employeeCount} assigned employee(s). Please reassign or remove employees first.`,
      );
    }

    if (hard) {
      const result = await this.subsidiaryModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new NotFoundException('Subsidiary not found');
      }
    } else {
      // Soft delete
      const result = await this.subsidiaryModel
        .findByIdAndUpdate(id, { status: 'inactive' }, { new: true })
        .exec();

      if (!result) {
        throw new NotFoundException('Subsidiary not found');
      }
    }
  }

  async getEmployeesBySubsidiary(
    subsidiaryId: string,
  ): Promise<EmployeeDocument[]> {
    if (!Types.ObjectId.isValid(subsidiaryId)) {
      throw new BadRequestException('Invalid subsidiary ID');
    }

    // Verify subsidiary exists
    const subsidiary = await this.findOne(subsidiaryId);
    if (!subsidiary) {
      throw new NotFoundException('Subsidiary not found');
    }

    const employees = await this.employeeModel
      .find({ subsidiaryId: new Types.ObjectId(subsidiaryId) })
      .sort({ firstLastName: 1, firstName: 1 })
      .exec();

    return employees;
  }

  async validateSubsidiaryExists(subsidiaryId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(subsidiaryId)) {
      throw new BadRequestException('Invalid subsidiary ID');
    }

    const subsidiary = await this.subsidiaryModel
      .findById(subsidiaryId)
      .select('_id status')
      .exec();

    if (!subsidiary) {
      throw new NotFoundException('Subsidiary not found');
    }

    if (subsidiary.status !== 'active') {
      throw new BadRequestException('Subsidiary is not active');
    }

    return true;
  }
}
