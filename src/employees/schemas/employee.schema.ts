import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

export type SalarySchedule = 'monthly' | 'biweekly' | 'weekly' | 'hourly';

@Schema({ timestamps: true })
export class EmployeeDocumentAttachment {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: false, trim: true, maxlength: 100 })
  category?: string;

  createdAt?: Date;
  updatedAt?: Date;
  _id?: MongooseSchema.Types.ObjectId;
}

const EmployeeDocumentAttachmentSchema = SchemaFactory.createForClass(
  EmployeeDocumentAttachment,
);

@Schema({ _id: false, timestamps: true })
export class SalaryEntry {
  @Prop({ required: true, min: 0 })
  amountCents: number; // store as integer CRC colones cents

  @Prop({ required: true, default: 'CRC', enum: ['CRC'] })
  currency: 'CRC';

  @Prop({ required: false, enum: ['monthly', 'biweekly', 'weekly', 'hourly'] })
  schedule?: SalarySchedule;

  @Prop({ type: Date, required: true })
  effectiveFrom: Date; // UTC date-only

  @Prop({ type: Date, required: false })
  effectiveTo?: Date | null; // null means current

  @Prop()
  note?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const SalaryEntrySchema = SchemaFactory.createForClass(SalaryEntry);

@Schema({ _id: false })
export class Address {
  @Prop({ required: false, trim: true, maxlength: 100 })
  province?: string;

  @Prop({ required: false, trim: true, maxlength: 100 })
  canton?: string;

  @Prop({ required: false, trim: true, maxlength: 100 })
  district?: string;

  @Prop({ required: false, trim: true, maxlength: 500 })
  exactAddress?: string;
}

const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ required: false, trim: true, maxlength: 200 })
  name?: string;

  @Prop({ required: false, match: /^\d{8}$/ })
  phone?: string;

  @Prop({ required: false, trim: true, maxlength: 100 })
  relationship?: string;
}

const EmergencyContactSchema = SchemaFactory.createForClass(EmergencyContact);

@Schema({ timestamps: true })
export class Employee {
  // Identification
  @Prop({ required: true, unique: true, match: /^\d{9}$/ })
  documentId: string; // Identificación - 9 digits

  // Name fields
  @Prop({ required: true, trim: true, maxlength: 100 })
  firstName: string; // Nombre

  @Prop({ required: true, trim: true, maxlength: 100 })
  firstLastName: string; // Apellido 1

  @Prop({ required: false, trim: true, maxlength: 100 })
  secondLastName?: string; // Apellido 2

  // Personal Information
  @Prop({ required: false, trim: true, maxlength: 100 })
  nationality?: string; // Nacionalidad

  @Prop({ type: Date, required: true })
  dob: Date; // Fecha de nacimiento

  @Prop({
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed', 'free_union'],
    required: false,
  })
  maritalStatus?: string; // Estado Civil

  @Prop({ required: false, trim: true, maxlength: 100 })
  education?: string; // Escolaridad

  // Contact Information
  @Prop({ required: true, match: /^\d{8}$/ })
  phone: string; // Teléfono - 8 digits

  @Prop({ required: false, trim: true, lowercase: true })
  email?: string; // Correo Electrónico

  @Prop({ type: AddressSchema, required: false })
  address?: Address; // Domicilio (Provincia, Cantón, Distrito, Dirección Exacta)

  // Emergency Contact
  @Prop({ type: EmergencyContactSchema, required: false })
  emergencyContact?: EmergencyContact; // Contacto de Emergencia

  // Work Information
  @Prop({ type: Date, required: true })
  dateOfHire: Date; // Ingreso a la empresa

  @Prop({ required: false, trim: true, maxlength: 200 })
  position?: string; // Puesto

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  // Uniform/Clothing
  @Prop({ required: false, trim: true, maxlength: 10 })
  shirtSize?: string; // Talla Camisa

  @Prop({ required: false, trim: true, maxlength: 10 })
  shoeSize?: string; // Número de Calzado

  // Financial Information
  @Prop({ required: false, trim: true, maxlength: 100 })
  bankAccount?: string; // Número de cuenta

  // Additional Information
  @Prop({ required: false, trim: true, maxlength: 1000 })
  notes?: string; // Observaciones

  // System fields
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  userId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: [SalaryEntrySchema], default: [] })
  salaryHistory: SalaryEntry[];

  @Prop({ type: [EmployeeDocumentAttachmentSchema], default: [] })
  documents: EmployeeDocumentAttachment[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
EmployeeSchema.index({ firstLastName: 1 });
EmployeeSchema.index({ documentId: 1 });
