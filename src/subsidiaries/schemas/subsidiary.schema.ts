import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubsidiaryDocument = HydratedDocument<Subsidiary>;

@Schema({ _id: false })
export class SubsidiaryContact {
  @Prop({ required: false, trim: true, maxlength: 200 })
  name?: string;

  @Prop({ required: false, trim: true, lowercase: true })
  email?: string;

  @Prop({ required: false, match: /^\d{8}$/ })
  phone?: string; // 8 digits (Costa Rica format)
}

const SubsidiaryContactSchema = SchemaFactory.createForClass(SubsidiaryContact);

@Schema({ _id: false })
export class SubsidiaryAddress {
  @Prop({ required: true, trim: true, maxlength: 100 })
  province: string;

  @Prop({ required: false, trim: true, maxlength: 100 })
  canton?: string;
}

const SubsidiaryAddressSchema = SchemaFactory.createForClass(SubsidiaryAddress);

@Schema({ timestamps: true })
export class Subsidiary {
  @Prop({ required: true, unique: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ type: SubsidiaryAddressSchema, required: false })
  address?: SubsidiaryAddress;

  @Prop({ type: SubsidiaryContactSchema, required: false })
  contact?: SubsidiaryContact;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  googleMapsUrl: string;

  @Prop({ required: false, type: Number, min: -90, max: 90 })
  latitude?: number;

  @Prop({ required: false, type: Number, min: -180, max: 180 })
  longitude?: number;

  @Prop({ required: false, type: Object })
  inventory?: Record<string, any>; // TBD - placeholder for future inventory module

  @Prop({ required: false, trim: true, maxlength: 1000 })
  notes?: string;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  createdAt?: Date;
  updatedAt?: Date;
}

export const SubsidiarySchema = SchemaFactory.createForClass(Subsidiary);

// Indexes
SubsidiarySchema.index({ name: 1 });
SubsidiarySchema.index({ status: 1 });
