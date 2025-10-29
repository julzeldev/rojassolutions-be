import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { getJwtConfig } from './constants';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PasswordReset,
  PasswordResetSchema,
} from './schemas/password-reset.schema';
import {
  PendingMfaSetup,
  PendingMfaSetupSchema,
} from './schemas/pending-mfa-setup.schema';
import { EmailModule } from '../email/email.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PreAuthStrategy } from './strategies/pre-auth.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    ThrottlerModule.forRoot([{ ttl: 60, limit: 120 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const cfg = getJwtConfig(configService);
        return {
          secret: cfg.secret,
          signOptions: { expiresIn: cfg.expiresIn },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: PendingMfaSetup.name, schema: PendingMfaSetupSchema },
    ]),
    UsersModule,
    EmailModule,
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    PreAuthStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
