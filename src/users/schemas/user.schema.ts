import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: ['admin', 'employee'], default: 'employee' })
  role: 'admin' | 'employee';

  @Prop({ default: false })
  mfaEnabled: boolean;

  @Prop()
  mfaSecret?: string;

  @Prop({ type: [String], default: [] })
  refreshTokens?: string[];

  // createdAt and updatedAt are added by timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
