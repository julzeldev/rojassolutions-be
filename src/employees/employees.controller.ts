import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Header,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AddSalaryDto } from './dto/add-salary.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { SeedEmployeesDto } from './dto/seed-employees.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('admin')
  findAll(
    @Query('q') q?: string,
    @Query('status') status?: 'active' | 'inactive',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.findAll({
      q: q || undefined,
      status: status || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('statistics')
  @Roles('admin')
  getStatistics() {
    return this.service.getEmployeeStatistics();
  }

  @Get('export')
  @Roles('admin')
  async exportEmployees(
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    const exportFormat = format || 'csv';
    const result = await this.service.exportEmployeesToFile(exportFormat);

    if (exportFormat === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="empleados.xlsx"',
      );
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="empleados.csv"',
      );
    }

    res.send(result);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id, { soft: true });
  }

  @Get(':id/salary')
  @Roles('admin')
  getCurrentSalary(@Param('id') id: string) {
    return this.service.getCurrentSalary(id);
  }

  @Get(':id/salaries')
  @Roles('admin')
  getSalaries(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getSalaryHistory(id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post(':id/salaries')
  @Roles('admin')
  addSalary(
    @Param('id') id: string,
    @Body() dto: AddSalaryDto,
    @Req() req: Request,
  ) {
    const adminId = (req.user as { userId?: string } | undefined)?.userId;
    if (!adminId) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return this.service.addSalary(id, dto, adminId);
  }

  @Get(':id/vacations')
  @Roles('admin')
  getVacationSummary(@Param('id') id: string) {
    return this.service.getVacationSummary(id);
  }

  @Post(':id/documents')
  @Roles('admin')
  addDocument(@Param('id') id: string, @Body() dto: AddDocumentDto) {
    return this.service.addDocument(id, dto);
  }

  @Delete(':id/documents/:documentId')
  @Roles('admin')
  removeDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.service.removeDocument(id, documentId);
  }

  @Get('superadmin/dump')
  @Roles('admin')
  dumpEmployees() {
    return this.service.dumpAllEmployees();
  }

  @Post('superadmin/seed')
  @Roles('admin')
  seedEmployees(@Body() dto: SeedEmployeesDto) {
    return this.service.seedDemoEmployees(dto.clearExisting ?? false);
  }

  @Post('import')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  importEmployees(
    @UploadedFile() file: Express.Multer.File,
    @Body('strategy') strategy: 'skip' | 'update' | 'replace',
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de archivo no soportado. Use CSV o Excel (.xlsx)',
      );
    }

    return this.service.importEmployeesFromFile(
      file.buffer,
      file.mimetype,
      strategy || 'skip',
    );
  }
}
