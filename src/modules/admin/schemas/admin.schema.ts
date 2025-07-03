// src/admin/schemas/admin.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdminDocument = Admin & Document & { password?: string };

export enum AdminStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Schema({ timestamps: true })
export class Admin {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  ssn: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: true,
    enum: AdminStatus,
    default: AdminStatus.ACTIVE,
  })
  status: AdminStatus;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
