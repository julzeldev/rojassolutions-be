import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dtos/create-admin.dto';
import { UpdateAdminDto } from './dtos/update-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

function excludePassword<T extends Record<string, any>>(
  obj: T,
): Omit<T, 'password'> {
  const result = { ...obj };
  delete result.password;
  return result;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admins')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** Create a new Admin */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAdminDto: CreateAdminDto) {
    const admin = await this.adminService.create(createAdminDto);
    const safe = excludePassword(admin);
    return safe;
  }

  /** Retrieve all Admins */
  @Get()
  async findAll() {
    const admins = await this.adminService.findAll();
    return admins.map((admin) => excludePassword(admin));
  }

  /** Retrieve a single Admin by ID */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const admin = await this.adminService.findOne(id);
    const safe = excludePassword(admin);
    return safe;
  }

  /** Update an Admin */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    const admin = await this.adminService.update(id, updateAdminDto);
    const safe = excludePassword(admin);
    return safe;
  }

  /** Delete an Admin */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.adminService.remove(id);
  }
}
