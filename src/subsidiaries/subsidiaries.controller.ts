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
} from '@nestjs/common';
import { SubsidiariesService } from './subsidiaries.service';
import { CreateSubsidiaryDto } from './dto/create-subsidiary.dto';
import { UpdateSubsidiaryDto } from './dto/update-subsidiary.dto';
import { SubsidiaryQueryDto } from './dto/subsidiary-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('subsidiaries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubsidiariesController {
  constructor(private readonly subsidiariesService: SubsidiariesService) {}

  @Post()
  @Roles('admin')
  create(@Body() createSubsidiaryDto: CreateSubsidiaryDto) {
    return this.subsidiariesService.create(createSubsidiaryDto);
  }

  @Get()
  @Roles('admin')
  findAll(@Query() query: SubsidiaryQueryDto) {
    return this.subsidiariesService.findAll(query);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.subsidiariesService.findOne(id);
  }

  @Get(':id/employees')
  @Roles('admin')
  getEmployees(@Param('id') id: string) {
    return this.subsidiariesService.getEmployeesBySubsidiary(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateSubsidiaryDto: UpdateSubsidiaryDto,
  ) {
    return this.subsidiariesService.update(id, updateSubsidiaryDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.subsidiariesService.remove(id, { hard: false });
  }
}
