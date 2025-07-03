import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TwoFactorStrategy } from './strategies/twofactor.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { TwoFactorGuard } from './guards/twofactor.guard';

@Module({
  imports: [
    // Register Admin model for credential lookup
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),

    // Passport module: default strategy can be overridden per route
    PassportModule,

    // JWT module: configure secret and expiration
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change_this_secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    TwoFactorStrategy,
    JwtAuthGuard,
    LocalAuthGuard,
    TwoFactorGuard,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
