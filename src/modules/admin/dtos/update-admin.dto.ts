import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminDto } from './create-admin.dto';

/**
 * All fields are optional; use this DTO to update any subset
 * of the Admin properties (firstName, lastName, email, ssn, password, status).
 */
export class UpdateAdminDto extends PartialType(CreateAdminDto) {}
