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
import * as nodemailer from 'nodemailer';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectModel(PasswordReset.name)
    private passwordResetModel: Model<PasswordResetDocument>,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const ok = await compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  async login(user: UserDocument) {
    // if MFA is enabled for this user, require verification step
    if (user.mfaEnabled) {
      return { mfaRequired: true, userId: String(user._id) };
    }
    return this.issueTokens(user);
  }

  /**
   * Internal utility to generate access + refresh tokens for a user (skips MFA gate).
   */
  private async issueTokens(user: UserDocument) {
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

  async generateMfaSetup(userId: string) {
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

  async verifyMfaAndLogin(userId: string, token: string) {
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

  async refresh(refreshToken: string) {
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

  async logout(refreshToken: string) {
    await this.usersService.removeRefreshToken(refreshToken);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return; // do not reveal existence
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await this.passwordResetModel.create({
      userId: user._id,
      token,
      expiresAt,
    });

    // send email via nodemailer
    const smtp = nodemailer as unknown as {
      createTransport: (opts: any) => { sendMail: (opts: any) => Promise<any> };
    };
    const transporter = smtp.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT || 1025),
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: email,
      subject: 'Password reset',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.passwordResetModel.findOne({ token }).exec();
    if (!record) throw new UnauthorizedException('Invalid token');
    if (record.expiresAt < new Date()) {
      await this.passwordResetModel.deleteOne({ _id: record._id }).exec();
      throw new UnauthorizedException('Token expired');
    }
    await this.usersService.update(String(record.userId), {
      password: newPassword,
    });
    // cleanup
    await this.passwordResetModel.deleteOne({ _id: record._id }).exec();
  }

  // Lightweight user fetch for controller /auth/me
  async getUser(userId: string) {
    return this.usersService.findOne(userId);
  }
}
