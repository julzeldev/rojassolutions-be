import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

export type SalarySchedule = 'monthly' | 'biweekly' | 'weekly' | 'hourly';

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

@Schema({ timestamps: true })
export class Employee {
  @Prop({ required: true, trim: true, maxlength: 100 })
  firstName: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  lastName: string;

  @Prop({ type: Date, required: true })
  dob: Date;

  @Prop({ type: Date, required: true })
  dateOfHire: Date;

  @Prop({ required: true, unique: true, match: /^\d{9}$/ })
  documentId: string; // 9 digits

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  userId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: [SalaryEntrySchema], default: [] })
  salaryHistory: SalaryEntry[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
EmployeeSchema.index({ lastName: 1 });
