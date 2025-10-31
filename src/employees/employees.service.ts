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
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
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
        documentId: dto.documentId,
        firstName: dto.firstName.trim(),
        firstLastName: dto.firstLastName.trim(),
        secondLastName: dto.secondLastName?.trim(),
        nationality: dto.nationality?.trim(),
        dob,
        maritalStatus: dto.maritalStatus,
        education: dto.education?.trim(),
        phone: validatedPhone,
        email: this.toEmail((dto as { email?: unknown }).email),
        address: dto.address,
        emergencyContact: dto.emergencyContact,
        dateOfHire,
        position: dto.position?.trim(),
        status: dto.status ?? 'active',
        shirtSize: dto.shirtSize?.trim(),
        shoeSize: dto.shoeSize?.trim(),
        bankAccount: dto.bankAccount?.trim(),
        notes: dto.notes?.trim(),
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
        { firstLastName: regex },
        { secondLastName: regex },
        { documentId: regex },
        { phone: regex },
        { email: regex },
        { position: regex },
      ];
    }
    const [items, total] = await Promise.all([
      this.employeeModel
        .find(filter)
        .sort({ firstLastName: 1, firstName: 1 })
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
    if (dto.firstLastName) update.firstLastName = dto.firstLastName.trim();
    if (dto.secondLastName !== undefined)
      update.secondLastName = dto.secondLastName?.trim();
    if (dto.nationality !== undefined)
      update.nationality = dto.nationality?.trim();
    if (dto.maritalStatus !== undefined)
      update.maritalStatus = dto.maritalStatus;
    if (dto.education !== undefined) update.education = dto.education?.trim();
    if (dto.position !== undefined) update.position = dto.position?.trim();
    if (dto.shirtSize !== undefined) update.shirtSize = dto.shirtSize?.trim();
    if (dto.shoeSize !== undefined) update.shoeSize = dto.shoeSize?.trim();
    if (dto.bankAccount !== undefined)
      update.bankAccount = dto.bankAccount?.trim();
    if (dto.notes !== undefined) update.notes = dto.notes?.trim();
    if (dto.address !== undefined) update.address = dto.address;
    if (dto.emergencyContact !== undefined)
      update.emergencyContact = dto.emergencyContact;

    if (dto.dob || dto.dateOfHire) {
      const emp = await this.findOne(id);
      // keep YYYY-MM-DD (ISO date only) format — do not convert to slashes
      const dobStr = dto.dob ?? emp.dob.toISOString().slice(0, 10);
      const hireStr =
        dto.dateOfHire ?? emp.dateOfHire.toISOString().slice(0, 10);
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

  async dumpAllEmployees(): Promise<EmployeeDocument[]> {
    return this.employeeModel.find().exec();
  }

  async seedDemoEmployees(
    clearExisting: boolean,
  ): Promise<{ count: number; message: string }> {
    if (clearExisting) {
      await this.employeeModel.deleteMany({}).exec();
    }

    const demoEmployees: CreateEmployeeDto[] = [
      {
        documentId: '123456789',
        firstName: 'Carlos',
        firstLastName: 'González',
        secondLastName: 'Ramírez',
        nationality: 'Costarricense',
        dob: '1985-03-15',
        maritalStatus: 'married',
        education: 'Licenciatura en Administración',
        phone: '88887777',
        email: 'carlos.gonzalez@example.com',
        address: {
          province: 'San José',
          canton: 'Central',
          district: 'Carmen',
          exactAddress: '200m norte del parque central',
        },
        emergencyContact: {
          name: 'María González',
          phone: '88886666',
          relationship: 'Esposa',
        },
        dateOfHire: '2020-01-15',
        position: 'Gerente de Ventas',
        status: 'active',
        shirtSize: 'L',
        shoeSize: '42',
        bankAccount: 'CR12345678901234567890',
        notes: 'Empleado destacado del mes de enero 2024',
      },
      {
        documentId: '987654321',
        firstName: 'Ana',
        firstLastName: 'Martínez',
        secondLastName: 'Solís',
        nationality: 'Costarricense',
        dob: '1990-07-22',
        maritalStatus: 'single',
        education: 'Bachillerato en Contabilidad',
        phone: '88885555',
        email: 'ana.martinez@example.com',
        address: {
          province: 'Alajuela',
          canton: 'Alajuela',
          district: 'San José',
          exactAddress: '150m sur de la iglesia católica',
        },
        emergencyContact: {
          name: 'Pedro Martínez',
          phone: '88884444',
          relationship: 'Padre',
        },
        dateOfHire: '2019-05-10',
        position: 'Contadora',
        status: 'active',
        shirtSize: 'M',
        shoeSize: '37',
        bankAccount: 'CR09876543210987654321',
        notes: 'Responsable del área de finanzas',
      },
      {
        documentId: '456789123',
        firstName: 'José',
        firstLastName: 'Rodríguez',
        secondLastName: 'Campos',
        nationality: 'Costarricense',
        dob: '1988-11-08',
        maritalStatus: 'divorced',
        education: 'Técnico en Sistemas',
        phone: '88883333',
        email: 'jose.rodriguez@example.com',
        address: {
          province: 'Cartago',
          canton: 'Cartago',
          district: 'Oriental',
          exactAddress: '300m este del hospital',
        },
        emergencyContact: {
          name: 'Laura Campos',
          phone: '88882222',
          relationship: 'Madre',
        },
        dateOfHire: '2021-03-01',
        position: 'Desarrollador de Software',
        status: 'active',
        shirtSize: 'XL',
        shoeSize: '43',
        bankAccount: 'CR45678912345678912345',
        notes: 'Especialista en desarrollo backend',
      },
      {
        documentId: '321654987',
        firstName: 'María',
        firstLastName: 'Hernández',
        secondLastName: 'Vega',
        nationality: 'Costarricense',
        dob: '1992-04-18',
        maritalStatus: 'married',
        education: 'Licenciatura en Psicología',
        phone: '88881111',
        email: 'maria.hernandez@example.com',
        address: {
          province: 'Heredia',
          canton: 'Heredia',
          district: 'Mercedes',
          exactAddress: '100m norte del Mall Oxígeno',
        },
        emergencyContact: {
          name: 'Roberto Hernández',
          phone: '88880000',
          relationship: 'Esposo',
        },
        dateOfHire: '2018-08-20',
        position: 'Gerente de Recursos Humanos',
        status: 'active',
        shirtSize: 'S',
        shoeSize: '36',
        bankAccount: 'CR32165498732165498732',
        notes: 'Encargada de reclutamiento y selección',
      },
      {
        documentId: '147258369',
        firstName: 'Luis',
        firstLastName: 'Vargas',
        secondLastName: 'Mora',
        nationality: 'Costarricense',
        dob: '1987-09-30',
        maritalStatus: 'free_union',
        education: 'Bachillerato en Educación Media',
        phone: '87779999',
        email: 'luis.vargas@example.com',
        address: {
          province: 'Puntarenas',
          canton: 'Puntarenas',
          district: 'Puntarenas',
          exactAddress: '500m oeste del muelle',
        },
        emergencyContact: {
          name: 'Sofía Mora',
          phone: '87778888',
          relationship: 'Pareja',
        },
        dateOfHire: '2022-02-14',
        position: 'Supervisor de Logística',
        status: 'active',
        shirtSize: 'L',
        shoeSize: '41',
        bankAccount: 'CR14725836914725836914',
        notes: 'Coordinador de entregas regionales',
      },
      {
        documentId: '258369147',
        firstName: 'Carolina',
        firstLastName: 'Jiménez',
        secondLastName: 'Castro',
        nationality: 'Costarricense',
        dob: '1995-01-12',
        maritalStatus: 'single',
        education: 'Licenciatura en Marketing',
        phone: '87777777',
        email: 'carolina.jimenez@example.com',
        address: {
          province: 'San José',
          canton: 'Escazú',
          district: 'San Rafael',
          exactAddress: '250m sur de Multiplaza',
        },
        emergencyContact: {
          name: 'Andrea Castro',
          phone: '87776666',
          relationship: 'Hermana',
        },
        dateOfHire: '2021-06-01',
        position: 'Especialista en Marketing Digital',
        status: 'active',
        shirtSize: 'S',
        shoeSize: '38',
        bankAccount: 'CR25836914725836914725',
        notes: 'Manejo de redes sociales y campañas digitales',
      },
      {
        documentId: '369258147',
        firstName: 'Roberto',
        firstLastName: 'Chaves',
        secondLastName: 'Fernández',
        nationality: 'Costarricense',
        dob: '1983-12-25',
        maritalStatus: 'married',
        education: 'Ingeniería Industrial',
        phone: '87775555',
        email: 'roberto.chaves@example.com',
        address: {
          province: 'Limón',
          canton: 'Limón',
          district: 'Limón',
          exactAddress: '400m norte del parque Vargas',
        },
        emergencyContact: {
          name: 'Gabriela Fernández',
          phone: '87774444',
          relationship: 'Esposa',
        },
        dateOfHire: '2017-11-05',
        position: 'Gerente de Operaciones',
        status: 'active',
        shirtSize: 'XL',
        shoeSize: '44',
        bankAccount: 'CR36925814736925814736',
        notes: 'Más de 7 años en la empresa',
      },
      {
        documentId: '741852963',
        firstName: 'Patricia',
        firstLastName: 'Sánchez',
        secondLastName: 'Arias',
        nationality: 'Costarricense',
        dob: '1991-06-14',
        maritalStatus: 'single',
        education: 'Licenciatura en Comunicación',
        phone: '87773333',
        email: 'patricia.sanchez@example.com',
        address: {
          province: 'Guanacaste',
          canton: 'Liberia',
          district: 'Liberia',
          exactAddress: '600m este del aeropuerto',
        },
        emergencyContact: {
          name: 'Esteban Arias',
          phone: '87772222',
          relationship: 'Hermano',
        },
        dateOfHire: '2020-09-15',
        position: 'Coordinadora de Comunicaciones',
        status: 'active',
        shirtSize: 'M',
        shoeSize: '37',
        bankAccount: 'CR74185296374185296374',
        notes: 'Encargada de comunicación interna y externa',
      },
      {
        documentId: '852963741',
        firstName: 'Fernando',
        firstLastName: 'López',
        secondLastName: 'Rojas',
        nationality: 'Costarricense',
        dob: '1986-02-28',
        maritalStatus: 'widowed',
        education: 'Bachillerato en Administración',
        phone: '87771111',
        email: 'fernando.lopez@example.com',
        address: {
          province: 'San José',
          canton: 'Desamparados',
          district: 'San Miguel',
          exactAddress: '100m sur de la municipalidad',
        },
        emergencyContact: {
          name: 'Carmen Rojas',
          phone: '87770000',
          relationship: 'Madre',
        },
        dateOfHire: '2019-04-10',
        position: 'Asistente Administrativo',
        status: 'active',
        shirtSize: 'M',
        shoeSize: '40',
        bankAccount: 'CR85296374185296374185',
        notes: 'Apoyo en gestión administrativa general',
      },
      {
        documentId: '963852741',
        firstName: 'Daniela',
        firstLastName: 'Morales',
        secondLastName: 'Cruz',
        nationality: 'Costarricense',
        dob: '1993-08-05',
        maritalStatus: 'married',
        education: 'Técnico en Enfermería',
        phone: '86669999',
        email: 'daniela.morales@example.com',
        address: {
          province: 'San José',
          canton: 'Curridabat',
          district: 'Granadilla',
          exactAddress: '200m este del centro comercial',
        },
        emergencyContact: {
          name: 'Miguel Cruz',
          phone: '86668888',
          relationship: 'Esposo',
        },
        dateOfHire: '2021-01-20',
        position: 'Enfermera Ocupacional',
        status: 'active',
        shirtSize: 'S',
        shoeSize: '36',
        bankAccount: 'CR96385274196385274196',
        notes: 'Responsable de salud ocupacional',
      },
      {
        documentId: '159753486',
        firstName: 'Andrés',
        firstLastName: 'Ramírez',
        secondLastName: 'Bonilla',
        nationality: 'Costarricense',
        dob: '1989-10-20',
        maritalStatus: 'single',
        education: 'Licenciatura en Derecho',
        phone: '86667777',
        email: 'andres.ramirez@example.com',
        address: {
          province: 'Alajuela',
          canton: 'San Ramón',
          district: 'San Ramón',
          exactAddress: '350m norte del parque central',
        },
        emergencyContact: {
          name: 'Isabel Bonilla',
          phone: '86666666',
          relationship: 'Madre',
        },
        dateOfHire: '2018-07-12',
        position: 'Asesor Legal',
        status: 'active',
        shirtSize: 'L',
        shoeSize: '42',
        bankAccount: 'CR15975348615975348615',
        notes: 'Manejo de asuntos legales y contratos',
      },
      {
        documentId: '357159486',
        firstName: 'Gabriela',
        firstLastName: 'Pérez',
        secondLastName: 'Monge',
        nationality: 'Costarricense',
        dob: '1994-05-17',
        maritalStatus: 'free_union',
        education: 'Bachillerato en Diseño Gráfico',
        phone: '86665555',
        email: 'gabriela.perez@example.com',
        address: {
          province: 'Heredia',
          canton: 'San Pablo',
          district: 'San Pablo',
          exactAddress: '150m oeste del supermercado',
        },
        emergencyContact: {
          name: 'Daniel Monge',
          phone: '86664444',
          relationship: 'Pareja',
        },
        dateOfHire: '2022-03-08',
        position: 'Diseñadora Gráfica',
        status: 'active',
        shirtSize: 'M',
        shoeSize: '37',
        bankAccount: 'CR35715948635715948635',
        notes: 'Creación de material publicitario',
      },
      {
        documentId: '486159357',
        firstName: 'Esteban',
        firstLastName: 'Navarro',
        secondLastName: 'Salazar',
        nationality: 'Costarricense',
        dob: '1984-03-09',
        maritalStatus: 'divorced',
        education: 'Ingeniería Civil',
        phone: '86663333',
        email: 'esteban.navarro@example.com',
        address: {
          province: 'Cartago',
          canton: 'La Unión',
          district: 'Tres Ríos',
          exactAddress: '500m sur de la plaza',
        },
        emergencyContact: {
          name: 'Rodrigo Salazar',
          phone: '86662222',
          relationship: 'Hermano',
        },
        dateOfHire: '2017-09-25',
        position: 'Ingeniero de Proyectos',
        status: 'active',
        shirtSize: 'L',
        shoeSize: '43',
        bankAccount: 'CR48615935748615935748',
        notes: 'Supervisión de proyectos de infraestructura',
      },
      {
        documentId: '753951852',
        firstName: 'Valeria',
        firstLastName: 'Campos',
        secondLastName: 'Aguilar',
        nationality: 'Costarricense',
        dob: '1996-11-23',
        maritalStatus: 'single',
        education: 'Técnico en Turismo',
        phone: '86661111',
        email: 'valeria.campos@example.com',
        address: {
          province: 'Puntarenas',
          canton: 'Quepos',
          district: 'Quepos',
          exactAddress: '100m norte de la marina',
        },
        emergencyContact: {
          name: 'Sofía Aguilar',
          phone: '86660000',
          relationship: 'Hermana',
        },
        dateOfHire: '2023-01-15',
        position: 'Coordinadora de Turismo',
        status: 'inactive',
        shirtSize: 'S',
        shoeSize: '38',
        bankAccount: 'CR75395185275395185275',
        notes: 'Temporalmente inactiva por licencia',
      },
    ];

    const created = await Promise.all(
      demoEmployees.map((dto) => this.create(dto)),
    );

    return {
      count: created.length,
      message: `${created.length} empleados demo creados exitosamente`,
    };
  }

  async exportEmployeesToFile(
    format: string = 'csv',
  ): Promise<Buffer | string> {
    const employees = await this.employeeModel.find().exec();

    const exportData = employees.map((emp) => ({
      Cédula: emp.documentId,
      'Primer Nombre': emp.firstName,
      'Primer Apellido': emp.firstLastName,
      'Segundo Apellido': emp.secondLastName || '',
      Nacionalidad: emp.nationality || '',
      'Fecha Nacimiento': this.formatDateForExport(emp.dob),
      'Estado Civil': emp.maritalStatus || '',
      Educación: emp.education || '',
      Teléfono: emp.phone,
      Correo: emp.email,
      Dirección: emp.address || '',
      'Contacto Emergencia': emp.emergencyContact || '',
      'Fecha Contratación': this.formatDateForExport(emp.dateOfHire),
      Puesto: emp.position || '',
      Estado: emp.status,
      'Talla Camisa': emp.shirtSize || '',
      'Talla Zapato': emp.shoeSize || '',
      'Cuenta Bancaria': emp.bankAccount || '',
      Notas: emp.notes || '',
    }));

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados');
      return XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer;
    } else {
      // CSV format
      return Papa.unparse(exportData, {
        quotes: true,
        delimiter: ',',
        header: true,
      }) as string;
    }
  }

  async importEmployeesFromFile(
    fileBuffer: Buffer,
    mimeType: string,
    strategy: 'skip' | 'update' | 'replace' = 'skip',
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ documentId: string; error: string }>;
    message: string;
  }> {
    let employeesData: Array<Record<string, any>> = [];

    try {
      if (mimeType === 'text/csv') {
        // Parse CSV
        const csvString = fileBuffer.toString('utf-8');
        const parsed = Papa.parse<Record<string, any>>(csvString, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim(),
        });
        employeesData = parsed.data as Array<Record<string, any>>;
      } else {
        // Parse Excel
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (sheetName && workbook.Sheets[sheetName]) {
          employeesData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }
      }
    } catch (error) {
      throw new BadRequestException(
        'Error al leer el archivo: ' +
          (error instanceof Error ? error.message : 'formato inválido'),
      );
    }

    if (!employeesData || employeesData.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene empleados para importar',
      );
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    // Strategy: REPLACE - Delete all existing employees first
    if (strategy === 'replace') {
      await this.employeeModel.deleteMany({}).exec();
    }

    // Process each employee
    for (const row of employeesData) {
      try {
        // Map Spanish column names to DTO fields
        const empData: CreateEmployeeDto = {
          documentId: (row['Cédula'] || row['documentId'] || '') as string,
          firstName: (row['Primer Nombre'] || row['firstName'] || '') as string,
          firstLastName: (row['Primer Apellido'] ||
            row['firstLastName'] ||
            '') as string,
          secondLastName: (row['Segundo Apellido'] ||
            row['secondLastName']) as string,
          nationality: (row['Nacionalidad'] || row['nationality']) as string,
          dob: (row['Fecha Nacimiento'] || row['dob'] || '') as string,
          maritalStatus: (row['Estado Civil'] ||
            row['maritalStatus']) as string,
          education: (row['Educación'] || row['education']) as string,
          phone: (row['Teléfono'] || row['phone'] || '') as string,
          email: (row['Correo'] || row['email'] || '') as string,
          address:
            typeof (row['Dirección'] || row['address']) !== 'string'
              ? ((row['Dirección'] || row['address']) as
                  | {
                      province?: string;
                      canton?: string;
                      district?: string;
                      exactAddress?: string;
                    }
                  | undefined)
              : undefined,
          emergencyContact:
            typeof (row['Contacto Emergencia'] || row['emergencyContact']) !==
            'string'
              ? ((row['Contacto Emergencia'] || row['emergencyContact']) as
                  | { name?: string; phone?: string; relationship?: string }
                  | undefined)
              : undefined,
          dateOfHire: (row['Fecha Contratación'] ||
            row['dateOfHire'] ||
            '') as string,
          position: (row['Puesto'] || row['position']) as string,
          status: (row['Estado'] || row['status'] || 'active') as
            | 'active'
            | 'inactive',
          shirtSize: (row['Talla Camisa'] || row['shirtSize']) as string,
          shoeSize: (row['Talla Zapato'] || row['shoeSize']) as string,
          bankAccount: (row['Cuenta Bancaria'] || row['bankAccount']) as string,
          notes: (row['Notas'] || row['notes']) as string,
        };

        if (
          !empData.documentId ||
          !empData.firstName ||
          !empData.firstLastName
        ) {
          errors.push({
            documentId: empData.documentId || 'N/A',
            error: 'Faltan campos obligatorios (cédula, nombre, apellido)',
          });
          continue;
        }

        const existing = await this.employeeModel
          .findOne({ documentId: empData.documentId })
          .exec();

        if (existing) {
          if (strategy === 'skip') {
            skipped++;
            continue;
          } else if (strategy === 'update') {
            // Update existing employee
            const { dob, dateOfHire } = this.parseAndValidateDates(
              empData.dob,
              empData.dateOfHire,
            );

            const update: Partial<EmployeeDocument> = {
              firstName: empData.firstName.trim(),
              firstLastName: empData.firstLastName.trim(),
              secondLastName: empData.secondLastName?.trim(),
              nationality: empData.nationality?.trim(),
              dob,
              maritalStatus: empData.maritalStatus,
              education: empData.education?.trim(),
              phone: empData.phone.trim(),
              email: this.toEmail(empData.email),
              address: empData.address,
              emergencyContact: empData.emergencyContact,
              dateOfHire,
              position: empData.position?.trim(),
              status: empData.status ?? 'active',
              shirtSize: empData.shirtSize?.trim(),
              shoeSize: empData.shoeSize?.trim(),
              bankAccount: empData.bankAccount?.trim(),
              notes: empData.notes?.trim(),
            };

            await this.employeeModel
              .updateOne({ _id: existing._id }, { $set: update })
              .exec();
            updated++;
          }
        } else {
          // Create new employee
          await this.create(empData);
          imported++;
        }
      } catch (error) {
        errors.push({
          documentId: String(row['Cédula'] || row['documentId'] || 'N/A'),
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    let message = '';
    if (strategy === 'replace') {
      message = `Importación completa: ${imported} empleados importados`;
    } else {
      const parts: string[] = [];
      if (imported > 0) parts.push(`${imported} nuevos`);
      if (updated > 0) parts.push(`${updated} actualizados`);
      if (skipped > 0) parts.push(`${skipped} omitidos`);
      if (errors.length > 0) parts.push(`${errors.length} errores`);
      message = parts.length > 0 ? parts.join(', ') : 'Sin cambios';
    }

    return { imported, updated, skipped, errors, message };
  }

  async exportEmployees(): Promise<{
    employees: CreateEmployeeDto[];
    exportedAt: string;
    total: number;
  }> {
    const employees = await this.employeeModel.find().exec();

    const exportData: CreateEmployeeDto[] = employees.map((emp) => ({
      documentId: emp.documentId,
      firstName: emp.firstName,
      firstLastName: emp.firstLastName,
      secondLastName: emp.secondLastName,
      nationality: emp.nationality,
      dob: this.formatDateForExport(emp.dob),
      maritalStatus: emp.maritalStatus,
      education: emp.education,
      phone: emp.phone,
      email: emp.email,
      address: emp.address,
      emergencyContact: emp.emergencyContact,
      dateOfHire: this.formatDateForExport(emp.dateOfHire),
      position: emp.position,
      status: emp.status,
      shirtSize: emp.shirtSize,
      shoeSize: emp.shoeSize,
      bankAccount: emp.bankAccount,
      notes: emp.notes,
    }));

    return {
      employees: exportData,
      exportedAt: new Date().toISOString(),
      total: exportData.length,
    };
  }

  async importEmployees(dto: {
    employees: CreateEmployeeDto[];
    strategy?: 'skip' | 'update' | 'replace';
  }): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ documentId: string; error: string }>;
    message: string;
  }> {
    const strategy = dto.strategy || 'skip';
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    // Strategy: REPLACE - Delete all existing employees first
    if (strategy === 'replace') {
      await this.employeeModel.deleteMany({}).exec();
    }

    // Process each employee
    for (const empData of dto.employees) {
      try {
        const existing = await this.employeeModel
          .findOne({ documentId: empData.documentId })
          .exec();

        if (existing) {
          if (strategy === 'skip' || strategy === 'replace') {
            skipped++;
            continue;
          } else if (strategy === 'update') {
            // Update existing employee
            const { dob, dateOfHire } = this.parseAndValidateDates(
              empData.dob,
              empData.dateOfHire,
            );

            const update: Partial<EmployeeDocument> = {
              firstName: empData.firstName.trim(),
              firstLastName: empData.firstLastName.trim(),
              secondLastName: empData.secondLastName?.trim(),
              nationality: empData.nationality?.trim(),
              dob,
              maritalStatus: empData.maritalStatus,
              education: empData.education?.trim(),
              phone: empData.phone.trim(),
              email: this.toEmail(empData.email),
              address: empData.address,
              emergencyContact: empData.emergencyContact,
              dateOfHire,
              position: empData.position?.trim(),
              status: empData.status ?? 'active',
              shirtSize: empData.shirtSize?.trim(),
              shoeSize: empData.shoeSize?.trim(),
              bankAccount: empData.bankAccount?.trim(),
              notes: empData.notes?.trim(),
            };

            await this.employeeModel
              .updateOne({ _id: existing._id }, { $set: update })
              .exec();
            updated++;
          }
        } else {
          // Create new employee
          await this.create(empData);
          imported++;
        }
      } catch (error) {
        errors.push({
          documentId: empData.documentId,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    let message = '';
    if (strategy === 'replace') {
      message = `Importación completa: ${imported} empleados importados`;
    } else {
      const parts: string[] = [];
      if (imported > 0) parts.push(`${imported} nuevos`);
      if (updated > 0) parts.push(`${updated} actualizados`);
      if (skipped > 0) parts.push(`${skipped} omitidos`);
      if (errors.length > 0) parts.push(`${errors.length} errores`);
      message = parts.length > 0 ? parts.join(', ') : 'Sin cambios';
    }

    return { imported, updated, skipped, errors, message };
  }

  async getEmployeeStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byProvince: Array<{ province: string; count: number }>;
    byAgeRange: Array<{ range: string; count: number }>;
    byGender: Array<{ gender: string; count: number }>;
    byPosition: Array<{ position: string; count: number }>;
    averageAge: number;
    averageTenure: number;
  }> {
    const employees = await this.employeeModel.find().exec();

    const total = employees.length;
    const active = employees.filter((e) => e.status === 'active').length;
    const inactive = total - active;

    // By Province - extract from address field
    const provinceMap = new Map<string, number>();
    employees.forEach((emp) => {
      let province = 'Desconocido';

      if (emp.address && emp.address.province) {
        province = emp.address.province;
      }

      provinceMap.set(province, (provinceMap.get(province) || 0) + 1);
    });
    const byProvince = Array.from(provinceMap.entries())
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count);

    // By Age Range
    const today = new Date();
    const ageRanges = {
      '18-25': 0,
      '26-35': 0,
      '36-45': 0,
      '46-55': 0,
      '56+': 0,
    };

    let totalAge = 0;
    let ageCount = 0;

    employees.forEach((emp) => {
      if (emp.dob) {
        const age = Math.floor(
          (today.getTime() - new Date(emp.dob).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        );
        totalAge += age;
        ageCount++;

        if (age >= 18 && age <= 25) ageRanges['18-25']++;
        else if (age >= 26 && age <= 35) ageRanges['26-35']++;
        else if (age >= 36 && age <= 45) ageRanges['36-45']++;
        else if (age >= 46 && age <= 55) ageRanges['46-55']++;
        else if (age >= 56) ageRanges['56+']++;
      }
    });

    const byAgeRange = Object.entries(ageRanges).map(([range, count]) => ({
      range,
      count,
    }));

    // By Gender - derived from maritalStatus or could be a new field
    // For now, we'll skip this or derive from name patterns (not reliable)
    const byGender = [{ gender: 'No especificado', count: total }];

    // By Position
    const positionMap = new Map<string, number>();
    employees.forEach((emp) => {
      const position = emp.position || 'Sin especificar';
      positionMap.set(position, (positionMap.get(position) || 0) + 1);
    });
    const byPosition = Array.from(positionMap.entries())
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 positions

    const averageAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;

    // Average Tenure (years)
    let totalTenure = 0;
    let tenureCount = 0;
    employees.forEach((emp) => {
      if (emp.dateOfHire) {
        const tenure =
          (today.getTime() - new Date(emp.dateOfHire).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000);
        totalTenure += tenure;
        tenureCount++;
      }
    });
    const averageTenure =
      tenureCount > 0 ? Math.round((totalTenure / tenureCount) * 10) / 10 : 0;

    return {
      total,
      active,
      inactive,
      byProvince,
      byAgeRange,
      byGender,
      byPosition,
      averageAge,
      averageTenure,
    };
  }

  private formatDateForExport(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
