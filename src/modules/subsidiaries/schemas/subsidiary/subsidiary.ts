import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Subsidiary extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  mapsUrl: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    _id: false,
  })
  location: {
    type: 'Point';
    coordinates: number[];
  };

  @Prop({
    type: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
    },
    _id: false,
  })
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  supervisorId?: Types.ObjectId;
}

export const SubsidiarySchema = SchemaFactory.createForClass(Subsidiary);
SubsidiarySchema.index({ name: 1 }, { unique: true });
SubsidiarySchema.index({ location: '2dsphere' });
