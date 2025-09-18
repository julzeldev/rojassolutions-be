import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  Employee,
  EmployeeDocument,
  EmployeeDocumentAttachment,
  SalaryEntry,
} from './schemas/employee.schema';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AddSalaryDto } from './dto/add-salary.dto';
import { oneDayBeforeUtc, parseYyyyMmDdToUtcDate } from '../utils/date';
import { UsersService } from '../users/users.service';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
    private readonly usersService: UsersService,
  ) {}

  private parseAndValidateDates(dobStr: string, hireStr: string) {
    const dob = parseYyyyMmDdToUtcDate(dobStr);
    const dateOfHire = parseYyyyMmDdToUtcDate(hireStr);
    const today = new Date();
    const todayUTC = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    if (dob >= todayUTC) throw new BadRequestException('dob must be in past');
    if (dateOfHire < dob)
      throw new BadRequestException('dateOfHire must be >= dob');
    return { dob, dateOfHire };
  }

  // --- Type-safe helpers ---
  private toTrimmed(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private toEmail(value: unknown): string | undefined {
    const v = this.toTrimmed(value);
    return v ? v.toLowerCase() : undefined;
  }

  private async ensureAdminHasMfa(adminId: string): Promise<void> {
    const admin = await this.usersService.findOne(adminId);
    if (!admin) {
      throw new UnauthorizedException(
        'Administrador no encontrado en la sesión',
      );
    }
    if (!admin.mfaEnabled) {
      throw new ForbiddenException('Habilita MFA para gestionar salarios');
    }
  }

  async create(dto: CreateEmployeeDto): Promise<EmployeeDocument> {
    try {
      const { dob, dateOfHire } = this.parseAndValidateDates(
        dto.dob,
        dto.dateOfHire,
      );

      const validatedPhone = this.toTrimmed((dto as { phone: unknown }).phone);
      if (!validatedPhone) {
        throw new BadRequestException('phone must be a string');
      }

      const created = await this.employeeModel.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        dob,
        dateOfHire,
        documentId: dto.documentId,
        phone: validatedPhone,
        email: this.toEmail((dto as { email?: unknown }).email),
        status: dto.status ?? 'active',
        salaryHistory: [],
      });

      return created;
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (e?.code === 11000 && e?.keyPattern?.documentId) {
        throw new ConflictException('documentId already exists');
      }
      throw err;
    }
  }

  async findAll(options?: {
    q?: string;
    status?: 'active' | 'inactive';
    limit?: number;
    offset?: number;
  }): Promise<{ items: EmployeeDocument[]; total: number }> {
    const { q, status, limit = 20, offset = 0 } = options || {};
    const filter: FilterQuery<EmployeeDocument> = {};
    if (status) filter.status = status;
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { documentId: regex },
        { phone: regex },
        { email: regex },
      ];
    }
    const [items, total] = await Promise.all([
      this.employeeModel
        .find(filter)
        .sort({ lastName: 1, firstName: 1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.employeeModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findOne(id: string): Promise<EmployeeDocument> {
    const emp = await this.employeeModel.findById(id).exec();
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeDocument> {
    const update: Partial<Employee> = {};

    if (dto.firstName) update.firstName = dto.firstName.trim();
    if (dto.lastName) update.lastName = dto.lastName.trim();

    if (dto.dob || dto.dateOfHire) {
      const emp = await this.findOne(id);
      const dobStr =
        dto.dob ?? emp.dob.toISOString().slice(0, 10).replace(/-/g, '/');
      const hireStr =
        dto.dateOfHire ??
        emp.dateOfHire.toISOString().slice(0, 10).replace(/-/g, '/');
      const { dob, dateOfHire } = this.parseAndValidateDates(dobStr, hireStr);
      update.dob = dob;
      update.dateOfHire = dateOfHire;
    }

    if (dto.documentId) update.documentId = dto.documentId;

    {
      const phone = (dto as { phone?: unknown }).phone;
      if (phone !== undefined) {
        const validatedPhone = this.toTrimmed(phone);
        if (!validatedPhone) {
          throw new BadRequestException('phone must be a string');
        }
        update.phone = validatedPhone;
      }
    }

    if ('email' in dto) {
      update.email = this.toEmail((dto as { email?: unknown }).email);
    }

    if (dto.status) update.status = dto.status;

    try {
      const updated = await this.employeeModel
        .findByIdAndUpdate(id, update, { new: true })
        .exec();
      if (!updated) throw new NotFoundException('Employee not found');
      return updated;
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (e?.code === 11000 && e?.keyPattern?.documentId) {
        throw new ConflictException('documentId already exists');
      }
      throw err;
    }
  }

  async remove(id: string, { soft = true } = {}): Promise<void> {
    const action = soft
      ? this.employeeModel.findByIdAndUpdate(id, { status: 'inactive' })
      : this.employeeModel.findByIdAndDelete(id);
    const res = await action.exec();
    if (!res) throw new NotFoundException('Employee not found');
  }

  async getCurrentSalary(employeeId: string): Promise<SalaryEntry | null> {
    const emp = await this.findOne(employeeId);
    const curr = [...(emp.salaryHistory || [])]
      .filter((s) => !s.effectiveTo)
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
    return curr ?? null;
  }

  async getSalaryHistory(
    employeeId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ items: SalaryEntry[]; total: number }> {
    const emp = await this.findOne(employeeId);
    const all = [...(emp.salaryHistory || [])].sort(
      (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime(),
    );
    const total = all.length;
    const { limit = 20, offset = 0 } = options || {};
    const items = all.slice(offset, offset + limit);
    return { items, total };
  }

  async addSalary(
    employeeId: string,
    dto: AddSalaryDto,
    adminId: string,
  ): Promise<SalaryEntry> {
    await this.ensureAdminHasMfa(adminId);
    if (dto.currency !== 'CRC')
      throw new BadRequestException('currency must be CRC');

    const effectiveFrom = parseYyyyMmDdToUtcDate(dto.effectiveFrom);
    const emp = await this.findOne(employeeId);
    const history = emp.salaryHistory || [];
    const current = history.find((h) => !h.effectiveTo);

    if (current) {
      if (effectiveFrom <= current.effectiveFrom) {
        throw new BadRequestException(
          'effectiveFrom must be after current salary effectiveFrom',
        );
      }
      current.effectiveTo = oneDayBeforeUtc(effectiveFrom);
    }

    const entry: SalaryEntry = {
      amountCents: dto.amountCents,
      currency: 'CRC',
      schedule: dto.schedule,
      effectiveFrom,
      effectiveTo: null,
      note: dto.note,
    };

    emp.salaryHistory = [...history, entry];
    await this.employeeModel
      .updateOne(
        { _id: emp._id },
        { $set: { salaryHistory: emp.salaryHistory } },
      )
      .exec();

    return entry;
  }

  async getVacationSummary(employeeId: string): Promise<{
    accruedDays: number;
    daysWorked: number;
    nextAccrualDate: Date;
    lastCalculatedAt: Date;
  }> {
    const emp = await this.findOne(employeeId);
    const today = new Date();
    const daysWorked = Math.max(
      0,
      Math.floor((today.getTime() - emp.dateOfHire.getTime()) / 86_400_000),
    );
    const accrualRatePerDay = 12 / 350;
    const accruedDays = parseFloat((daysWorked * accrualRatePerDay).toFixed(2));

    const completedBlocks = Math.floor(daysWorked / 350);
    const nextAccrualDate = new Date(emp.dateOfHire.getTime());
    nextAccrualDate.setDate(
      nextAccrualDate.getDate() + (completedBlocks + 1) * 350,
    );

    return {
      accruedDays,
      daysWorked,
      nextAccrualDate,
      lastCalculatedAt: today,
    };
  }

  async addDocument(
    employeeId: string,
    payload: { name: string; url: string; category?: string },
  ): Promise<EmployeeDocumentAttachment> {
    const now = new Date();
    const updated = await this.employeeModel
      .findByIdAndUpdate(
        employeeId,
        {
          $push: {
            documents: {
              name: payload.name.trim(),
              url: payload.url,
              category: payload.category?.trim(),
              createdAt: now,
              updatedAt: now,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Employee not found');
    const attachment = (updated.documents || [])[
      (updated.documents || []).length - 1
    ];
    if (!attachment) throw new BadRequestException('Unable to add document');
    return attachment;
  }

  async removeDocument(employeeId: string, documentId: string): Promise<void> {
    const result = await this.employeeModel
      .updateOne(
        { _id: employeeId },
        { $pull: { documents: { _id: documentId } } },
      )
      .exec();
    if (result.matchedCount === 0)
      throw new NotFoundException('Employee not found');
    if (result.modifiedCount === 0)
      throw new NotFoundException('Document not found');
  }
}
