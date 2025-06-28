import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Patch,
  NotFoundException,
} from '@nestjs/common';
import { SubsidiariesService } from './subsidiaries.service';
import { CreateSubsidiaryDto, UpdateSubsidiaryDto } from './dto/subsidiary.dto';
import { Types } from 'mongoose';

@Controller('subsidiaries')
export class SubsidiariesController {
  constructor(private readonly subsidiariesService: SubsidiariesService) {}

  @Post()
  async create(@Body() createSubsidiaryDto: CreateSubsidiaryDto) {
    return this.subsidiariesService.create(createSubsidiaryDto);
  }

  @Get()
  async findAll() {
    return this.subsidiariesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Invalid subsidiary id');
    const subsidiary = await this.subsidiariesService.findOne(id);
    if (!subsidiary) throw new NotFoundException('Subsidiary not found');
    return subsidiary;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSubsidiaryDto: UpdateSubsidiaryDto,
  ) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Invalid subsidiary id');
    const updated = await this.subsidiariesService.update(
      id,
      updateSubsidiaryDto,
    );
    if (!updated) throw new NotFoundException('Subsidiary not found');
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Invalid subsidiary id');
    const deleted = await this.subsidiariesService.remove(id);
    if (!deleted) throw new NotFoundException('Subsidiary not found');
    return deleted;
  }
}
