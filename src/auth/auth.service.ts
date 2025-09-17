import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { compare } from '../utils/hash';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getJwtConfig } from './constants';
import { randomBytes } from 'crypto';
import { UserDocument } from '../users/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PasswordReset,
  PasswordResetDocument,
} from './schemas/password-reset.schema';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    @InjectModel(PasswordReset.name)
    private passwordResetModel: Model<PasswordResetDocument>,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const ok = await compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  async login(
    user: UserDocument,
  ): Promise<
    | { mfaRequired: true; userId: string }
    | { accessToken: string; refreshToken: string }
  > {
    // if MFA is enabled for this user, require verification step
    if (user.mfaEnabled) {
      return { mfaRequired: true, userId: String(user._id) };
    }
    return this.issueTokens(user);
  }

  /**
   * Internal utility to generate access + refresh tokens for a user (skips MFA gate).
   */
  private async issueTokens(
    user: UserDocument,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const cfg = getJwtConfig(this.configService);
    const payload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: cfg.secret,
      expiresIn: cfg.expiresIn,
    });
    // create a refresh token (random) and store hashed? for now store plain random
    const refreshToken = randomBytes(32).toString('hex');
    // persist refresh token for user
    await this.usersService.addRefreshToken(String(user._id), refreshToken);
    return { accessToken, refreshToken };
  }

  async generateMfaSetup(
    userId: string,
  ): Promise<{ secret: string; otpauth: string; qr: string }> {
    try {
      const auth = authenticator as unknown as {
        generateSecret: () => string;
        keyuri: (user: string, issuer: string, secret: string) => string;
        check: (token: string, secret: string) => boolean;
      };
      const qrLib = qrcode as unknown as {
        toDataURL: (s: string) => Promise<string>;
      };
      const secret = auth.generateSecret();
      const otpauth = auth.keyuri(userId, 'RojasSolutions', secret);
      const qr = await qrLib.toDataURL(otpauth);
      await this.usersService.updateMfaSecret(userId, secret);
      return { secret, otpauth, qr };
    } catch (err) {
      // Enhanced debug logging; remove once stable
      try {
        console.error('[generateMfaSetup] error', err);
        if (err instanceof Error) {
          console.error('[generateMfaSetup] stack', err.stack);
        }
      } catch {
        /* ignore logging errors */
      }
      // surface a controlled error
      throw new (await import('@nestjs/common')).InternalServerErrorException(
        'MFA setup failed',
      );
    }
  }

  async verifyMfaForEnable(userId: string, token: string): Promise<boolean> {
    const user = await this.usersService.findOne(userId);
    const secret = user.mfaSecret;
    if (!secret) return false;
    const auth2 = authenticator as unknown as {
      check: (token: string, secret: string) => boolean;
    };
    const ok = auth2.check(token, secret);
    if (ok) {
      await this.usersService.update(userId, { mfaEnabled: true });
    }
    return ok;
  }

  async verifyMfaAndLogin(
    userId: string,
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findOne(userId);
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA not enabled');
    }
    const auth3 = authenticator as unknown as {
      check: (token: string, secret: string) => boolean;
    };
    const ok = auth3.check(token, String(user.mfaSecret));
    if (!ok) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    // successful: directly issue tokens (do not re-trigger mfaRequired path)
    return this.issueTokens(user as UserDocument);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    // find user with this refresh token
    const user = await this.usersService.findByRefreshToken(refreshToken);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    const cfg = getJwtConfig(this.configService);
    const payload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: cfg.secret,
      expiresIn: cfg.expiresIn,
    });
    return { accessToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.usersService.removeRefreshToken(refreshToken);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return; // do not reveal existence

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await this.passwordResetModel.create({
      userId: user._id,
      token,
      expiresAt,
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    await this.emailService.send({
      to: email,
      subject: 'Password reset',
      text: `Reset your password: ${resetUrl}\nEste enlace expira en 60 minutos. Si no solicitaste este cambio, ignora este correo.`,
      html: `<p>Haz clic para restablecer tu contraseña:</p><p><a href="${resetUrl}">Restablecer contraseña</a></p><p>Este enlace expira en 60 minutos. Si no solicitaste este cambio, ignora este correo.</p>`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.passwordResetModel.findOne({ token }).exec();
    if (!record) throw new UnauthorizedException('Invalid token');
    if (record.expiresAt < new Date()) {
      await this.passwordResetModel.deleteOne({ _id: record._id }).exec();
      throw new UnauthorizedException('Token expired');
    }
    // Require MFA code if user has MFA enabled before allowing password change
    const user = await this.usersService.findOne(String(record.userId));
    if (user.mfaEnabled) {
      // Instead of directly resetting, we could require a verified MFA step.
      // Approach: mark a flag requiring MFA token submission along with reset.
      // For simplicity here, we abort unless a prior MFA verification process set a flag.
      throw new UnauthorizedException(
        'MFA verification required before password reset',
      );
    }
    await this.usersService.update(String(record.userId), {
      password: newPassword,
    });
    // cleanup
    await this.passwordResetModel.deleteOne({ _id: record._id }).exec();
  }

  // Lightweight user fetch for controller /auth/me
  async getUser(userId: string): Promise<UserDocument | null> {
    const user = await this.usersService.findOne(userId);
    return user as unknown as UserDocument | null; // cast due to Mongoose lean/document typing mismatch
  }
}
