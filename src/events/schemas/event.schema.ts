import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EventDocument = HydratedDocument<Event>;

export enum PredefinedEventType {
  INCAPACIDAD = 'incapacidad',
  PERMISO = 'permiso',
  COMPRA_INVENTARIO = 'compra_inventario',
  VISITA_SUCURSAL = 'visita_sucursal',
  CUSTOM = 'custom',
}

export enum EventType {
  CUSTOM = 'custom',
  BIRTHDAY = 'birthday',
  PREDEFINED = 'predefined',
}

export enum EventStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: false, trim: true, maxlength: 1000 })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(EventType),
    required: true,
    default: EventType.CUSTOM,
  })
  type: EventType;

  @Prop({ type: Date, required: true })
  eventDate: Date;

  @Prop({ required: false, trim: true })
  startTime?: string; // Format: HH:mm

  @Prop({ required: false, trim: true })
  endTime?: string; // Format: HH:mm

  @Prop({ type: Boolean, default: false })
  allDay: boolean;

  // Reference to Employee for birthday events
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  employeeId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(PredefinedEventType),
    required: false,
    default: PredefinedEventType.CUSTOM,
  })
  predefinedType?: PredefinedEventType;

  @Prop({ required: false, trim: true, maxlength: 7 })
  color?: string; // Hex color code

  @Prop({
    type: String,
    enum: Object.values(EventStatus),
    required: true,
    default: EventStatus.ACTIVE,
  })
  status: EventStatus;

  // User tracking
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  lastModifiedBy?: Types.ObjectId;

  // Timestamps (automatically managed by Mongoose)
  createdAt?: Date;
  updatedAt?: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Add indexes for better query performance
EventSchema.index({ eventDate: 1 });
EventSchema.index({ type: 1 });
EventSchema.index({ employeeId: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ createdBy: 1 });
