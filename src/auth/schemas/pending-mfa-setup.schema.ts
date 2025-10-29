import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PendingMfaSetupDocument = PendingMfaSetup & Document;

@Schema({ timestamps: true })
export class PendingMfaSetup {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ required: true })
  secret: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const PendingMfaSetupSchema =
  SchemaFactory.createForClass(PendingMfaSetup);

PendingMfaSetupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
