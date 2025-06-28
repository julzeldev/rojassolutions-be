import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subsidiary } from './schemas/subsidiary/subsidiary';
import { CreateSubsidiaryDto, UpdateSubsidiaryDto } from './dto/subsidiary.dto';

@Injectable()
export class SubsidiariesService {
  constructor(
    @InjectModel(Subsidiary.name)
    private readonly subsidiaryModel: Model<Subsidiary>,
  ) {}

  async create(createSubsidiaryDto: CreateSubsidiaryDto): Promise<Subsidiary> {
    const created = new this.subsidiaryModel(createSubsidiaryDto);
    return created.save();
  }

  async findAll(): Promise<Subsidiary[]> {
    return this.subsidiaryModel.find().exec();
  }

  async findOne(id: string): Promise<Subsidiary | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.subsidiaryModel.findById(id).exec();
  }

  async update(
    id: string,
    updateSubsidiaryDto: UpdateSubsidiaryDto,
  ): Promise<Subsidiary | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.subsidiaryModel
      .findByIdAndUpdate(id, updateSubsidiaryDto, { new: true })
      .exec();
  }

  async remove(id: string): Promise<Subsidiary | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.subsidiaryModel.findByIdAndDelete(id).exec();
  }
}
