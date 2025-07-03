import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { hash } from '../../utils/hash';
import { CreateAdminDto } from './dtos/create-admin.dto';
import { UpdateAdminDto } from './dtos/update-admin.dto';
import { Admin, AdminDocument } from './schemas/admin.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
  ) {}

  /**
   * Create a new Admin, hashing the password before saving.
   */
  async create(createAdminDto: CreateAdminDto): Promise<Admin> {
    // Hash the plain-text password
    const hashed = await hash(createAdminDto.password);
    const created = new this.adminModel({
      ...createAdminDto,
      password: hashed,
    });

    try {
      return await created.save();
    } catch (err) {
      if (
        err instanceof Error &&
        'code' in err &&
        typeof (err as Record<string, unknown>).code === 'number' &&
        (err as Record<string, unknown>).code === 11000
      ) {
        throw new BadRequestException('Email or SSN already in use');
      }
      throw err;
    }
  }

  /**
   * Return all Admins.
   */
  async findAll(): Promise<Admin[]> {
    return this.adminModel.find().exec();
  }

  /**
   * Find a single Admin by ID.
   */
  async findOne(id: string): Promise<Admin> {
    const admin = await this.adminModel.findById(id).exec();
    if (!admin) {
      throw new NotFoundException(`Admin with id ${id} not found`);
    }
    return admin;
  }

  /**
   * Update an existing Admin.
   * If password is included, re-hash it before updating.
   */
  async update(id: string, updateAdminDto: UpdateAdminDto): Promise<Admin> {
    // If password is being updated, hash it
    if (updateAdminDto.password) {
      updateAdminDto.password = await hash(updateAdminDto.password);
    }

    const updated = await this.adminModel
      .findByIdAndUpdate(id, updateAdminDto, { new: true, runValidators: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Admin with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Remove an Admin by ID.
   */
  async remove(id: string): Promise<void> {
    const result = await this.adminModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Admin with id ${id} not found`);
    }
  }
}
