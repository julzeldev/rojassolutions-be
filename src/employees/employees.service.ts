import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  Employee,
  EmployeeDocument,
  SalaryEntry,
} from './schemas/employee.schema';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AddSalaryDto } from './dto/add-salary.dto';
import { oneDayBeforeUtc, parseYyyyMmDdToUtcDate } from '../utils/date';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
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

  async create(dto: CreateEmployeeDto): Promise<EmployeeDocument> {
    try {
      const { dob, dateOfHire } = this.parseAndValidateDates(
        dto.dob,
        dto.dateOfHire,
      );
      const created = await this.employeeModel.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        dob,
        dateOfHire,
        documentId: dto.documentId,
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
    if (soft) {
      const res = await this.employeeModel
        .findByIdAndUpdate(id, { status: 'inactive' })
        .exec();
      if (!res) throw new NotFoundException('Employee not found');
    } else {
      const res = await this.employeeModel.findByIdAndDelete(id).exec();
      if (!res) throw new NotFoundException('Employee not found');
    }
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

  async addSalary(employeeId: string, dto: AddSalaryDto): Promise<SalaryEntry> {
    if (dto.currency !== 'CRC')
      throw new BadRequestException('currency must be CRC');
    // Parse effectiveFrom and validate ordering
    const effectiveFrom = parseYyyyMmDdToUtcDate(dto.effectiveFrom);

    const emp = await this.findOne(employeeId);
    // Ensure no overlap and only one open-ended
    const history = emp.salaryHistory || [];
    // If there is a current salary, close it if effectiveFrom is in the future or today+1
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
    } as SalaryEntry;

    // Push and save atomically
    emp.salaryHistory = [...history, entry];
    await this.employeeModel
      .updateOne(
        { _id: emp._id },
        {
          $set: { salaryHistory: emp.salaryHistory },
        },
      )
      .exec();
    return entry;
  }
}
