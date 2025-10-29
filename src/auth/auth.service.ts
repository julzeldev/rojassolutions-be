import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { compare, hash } from '../utils/hash';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getJwtConfig } from './constants';
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto';
import { UserDocument } from '../users/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PasswordReset,
  PasswordResetDocument,
} from './schemas/password-reset.schema';
import {
  PendingMfaSetup,
  PendingMfaSetupDocument,
} from './schemas/pending-mfa-setup.schema';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { EmailService } from '../email/email.service';

interface PreAuthTokenPayload {
  sub: string;
  scope: string[];
  type: 'pre-auth';
}
export type LoginResponse =
  | { requiresMfa: true; userId: string }
  | { requiresMfaSetup: true; preAuthToken: string };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    @InjectModel(PasswordReset.name)
    private passwordResetModel: Model<PasswordResetDocument>,
    @InjectModel(PendingMfaSetup.name)
    private pendingMfaModel: Model<PendingMfaSetupDocument>,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  private readonly totpAttempts = new Map<
    string,
    { count: number; first: number }
  >();

  private readonly recoveryAttempts = new Map<
    string,
    { count: number; first: number }
  >();

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

  login(user: UserDocument): LoginResponse {
    if (user.mfaEnabled) {
      return { requiresMfa: true, userId: String(user._id) };
    }

    const preAuthToken = this.createPreAuthToken(String(user._id));
    return { requiresMfaSetup: true, preAuthToken };
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

  private createPreAuthToken(userId: string): string {
    const cfg = getJwtConfig(this.configService);
    const payload: PreAuthTokenPayload = {
      sub: userId,
      scope: ['mfa:setup'],
      type: 'pre-auth',
    };

    return this.jwtService.sign(payload, {
      secret: cfg.secret,
      expiresIn: cfg.preAuthExpiresIn,
    });
  }

  private registerAttempt(
    map: Map<string, { count: number; first: number }>,
    key: string,
    limit: number,
    windowMs: number,
  ): void {
    const now = Date.now();
    const current = map.get(key);
    if (!current || now - current.first > windowMs) {
      map.set(key, { count: 1, first: now });
      return;
    }
    if (current.count >= limit) {
      throw new HttpException(
        'Too many MFA attempts. Please try later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    current.count += 1;
    map.set(key, current);
  }

  private clearAttempts(
    map: Map<string, { count: number; first: number }>,
    key: string,
  ): void {
    map.delete(key);
  }

  private getEncryptionKey(): Buffer {
    const raw = this.configService.get<string>('MFA_SECRET_ENC_KEY');
    if (!raw) {
      throw new InternalServerErrorException(
        'MFA secret encryption key not configured',
      );
    }
    return createHash('sha256').update(raw).digest();
  }

  private encryptValue(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
  }

  private decryptValue(secretEnc?: string | null): string | null {
    if (!secretEnc) return null;
    try {
      const buffer = Buffer.from(secretEnc, 'base64');
      if (buffer.length < 28) return null; // iv (12) + tag (16) + data
      const iv = buffer.subarray(0, 12);
      const tag = buffer.subarray(12, 28);
      const ciphertext = buffer.subarray(28);
      const key = this.getEncryptionKey();
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (err) {
      this.logger.error('Failed to decrypt MFA secret', err);
      return null;
    }
  }

  private async generateRecoveryCodes(count = 10): Promise<{
    plain: string[];
    records: { codeHash: string; codeEnc: string; usedAt: null }[];
  }> {
    const codes: string[] = [];
    for (let i = 0; i < count; i += 1) {
      codes.push(randomBytes(8).toString('hex'));
    }
    const hashed = await Promise.all(codes.map((code) => hash(code)));
    const records = hashed.map((codeHash, idx) => ({
      codeHash,
      codeEnc: this.encryptValue(codes[idx]),
      usedAt: null,
    }));
    return { plain: codes, records };
  }

  async initTotpSetup(
    userId: string,
  ): Promise<{ otpauthUrl: string; qrSvgDataUrl: string }> {
    const user = await this.usersService.findOne(userId);

    const auth = authenticator as unknown as {
      generateSecret: () => string;
      keyuri: (account: string, issuer: string, secret: string) => string;
    };
    const qrLib = qrcode as unknown as {
      toString: (s: string, opts: { type: 'svg' }) => Promise<string>;
    };

    const secret = auth.generateSecret();
    const issuer = 'RojasSolutions';
    const otpauthUrl = auth.keyuri(user.email, issuer, secret);

    const svg = await qrLib.toString(otpauthUrl, { type: 'svg' });
    const qrSvgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    // Get MFA setup expiration from config (in seconds), default to 600 (10 minutes)
    const mfaSetupExpiresIn =
      Number(this.configService.get('MFA_SETUP_EXPIRES_IN')) || 600;
    const expiresAt = new Date(Date.now() + mfaSetupExpiresIn * 1000);

    await this.pendingMfaModel
      .findOneAndUpdate(
        { userId },
        { secret, expiresAt },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return { otpauthUrl, qrSvgDataUrl };
  }

  async verifyTotpSetup(
    userId: string,
    token: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    recoveryCodes: string[];
    recoveryCodesShownOnce: boolean;
  }> {
    const pending = await this.pendingMfaModel.findOne({ userId }).exec();
    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException('MFA setup expired');
    }

    this.logger.debug(
      `Verifying TOTP setup for user ${userId}. Secret length: ${pending.secret.length}`,
    );

    const auth = authenticator as unknown as {
      checkDelta: (
        token: string,
        secret: string,
        opts: { window: number },
      ) => { delta: number } | null;
      verify: (opts: { token: string; secret: string }) => boolean;
    };

    const delta = auth.checkDelta(token, pending.secret, { window: 1 });
    this.logger.debug(`checkDelta result: ${JSON.stringify(delta)}`);

    if (delta === null) {
      this.logger.warn(
        `TOTP setup verification failed for user ${userId}: invalid token provided`,
      );
      throw new UnprocessableEntityException('Invalid TOTP code');
    }

    const secretEnc = this.encryptValue(pending.secret);
    const { plain: recoveryCodes, records } =
      await this.generateRecoveryCodes();

    await this.usersService.update(userId, {
      mfaEnabled: true,
      mfaSecretEnc: secretEnc,
      mfaRecoveryCodes: records,
      recoveryCodesShownOnce: false,
    });

    await this.usersService.clearMfaSecret(userId);
    await this.pendingMfaModel.deleteOne({ userId }).exec();

    const user = (await this.usersService.findOne(userId)) as UserDocument;
    const { accessToken, refreshToken } = await this.issueTokens(user);

    this.logger.log(`MFA TOTP setup successful for user ${userId}`);

    return {
      accessToken,
      refreshToken,
      recoveryCodes,
      recoveryCodesShownOnce: false,
    };
  }

  async verifyTotpLogin(
    userId: string,
    token: string,
    ip: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const attemptKey = `${userId}|${ip}`;
    this.registerAttempt(this.totpAttempts, attemptKey, 5, 5 * 60 * 1000);

    const user = await this.usersService.findOne(userId);
    if (!user.mfaEnabled) {
      throw new UnauthorizedException('MFA not enabled for this account');
    }

    const userWithSecret = user as {
      mfaSecretEnc?: string;
      mfaSecret?: string;
    };
    this.logger.debug(
      `User ${userId} has mfaSecretEnc: ${!!userWithSecret.mfaSecretEnc}, mfaSecret: ${!!userWithSecret.mfaSecret}`,
    );

    const secret =
      this.decryptValue(userWithSecret.mfaSecretEnc) ||
      (userWithSecret.mfaSecret ? String(userWithSecret.mfaSecret) : null);

    if (!secret) {
      throw new UnauthorizedException('MFA secret missing');
    }

    this.logger.debug(`Decrypted secret length: ${secret.length}`);

    const authLib = authenticator as unknown as {
      checkDelta: (
        token: string,
        secret: string,
        opts: { window: number },
      ) => { delta: number } | null;
    };

    const delta = authLib.checkDelta(token, secret, { window: 1 });
    if (delta === null) {
      this.logger.warn(`Invalid TOTP attempt for user ${userId}.`);
      throw new UnprocessableEntityException('Invalid TOTP code');
    }

    this.clearAttempts(this.totpAttempts, attemptKey);
    const tokens = await this.issueTokens(user as UserDocument);
    this.logger.log(`MFA TOTP login success for user ${userId}`);
    return tokens;
  }

  async recoveryLogin(
    email: string,
    recoveryCode: string,
    ip: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.mfaEnabled) {
      throw new UnauthorizedException('Invalid recovery login');
    }

    const attemptKey = `${String(user._id)}|${ip}`;
    this.registerAttempt(this.recoveryAttempts, attemptKey, 5, 10 * 60 * 1000);

    const codes =
      (
        user as unknown as {
          mfaRecoveryCodes?: {
            codeHash: string;
            codeEnc: string;
            usedAt?: Date | null;
          }[];
        }
      ).mfaRecoveryCodes ?? [];

    let matchedIndex = -1;
    for (let i = 0; i < codes.length; i += 1) {
      const entry = codes[i];
      const match = await compare(recoveryCode, entry.codeHash);
      if (match && matchedIndex === -1) {
        if (entry.usedAt) {
          // Still throw immediately if the code is already used, to avoid reusing codes.
          throw new UnprocessableEntityException('Recovery code already used');
        }
        matchedIndex = i;
      }
    }

    if (matchedIndex === -1) {
      throw new UnauthorizedException('Invalid recovery code');
    }

    const updatedCodes = codes.map((entry, idx) =>
      idx === matchedIndex ? { ...entry, usedAt: new Date() } : entry,
    );

    await this.usersService.update(String(user._id), {
      mfaRecoveryCodes: updatedCodes,
      recoveryCodesShownOnce: true,
    });

    this.clearAttempts(this.recoveryAttempts, attemptKey);

    const tokens = await this.issueTokens(user);
    this.logger.log(`MFA recovery login success for user ${String(user._id)}`);
    return tokens;
  }

  async getRecoveryCodes(
    userId: string,
  ): Promise<{ recoveryCodes: { code: string; usedAt: Date | null }[] }> {
    const user = await this.usersService.findOne(userId);
    if (!user.mfaEnabled) {
      throw new UnauthorizedException('MFA not enabled');
    }
    if (user.recoveryCodesShownOnce) {
      throw new ForbiddenException('Recovery codes already retrieved');
    }

    const codes =
      (
        user as unknown as {
          mfaRecoveryCodes?: {
            codeHash: string;
            codeEnc: string;
            usedAt?: Date | null;
          }[];
        }
      ).mfaRecoveryCodes ?? [];

    const payload = codes.map((entry) => ({
      code: this.decryptValue(entry.codeEnc) ?? '',
      usedAt: entry.usedAt ?? null,
    }));

    await this.usersService.update(userId, {
      recoveryCodesShownOnce: true,
    });

    return { recoveryCodes: payload };
  }

  async regenerateRecoveryCodes(
    userId: string,
    totpCode: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.usersService.findOne(userId);
    if (!user.mfaEnabled) {
      throw new UnauthorizedException('MFA not enabled');
    }

    const secret =
      this.decryptValue((user as { mfaSecretEnc?: string }).mfaSecretEnc) ||
      (user.mfaSecret ? String(user.mfaSecret) : null);
    if (!secret) {
      throw new UnauthorizedException('MFA secret missing');
    }

    const authLib = authenticator as unknown as {
      checkDelta: (
        token: string,
        secret: string,
        opts: { window: number },
      ) => { delta: number } | null;
    };

    const delta = authLib.checkDelta(totpCode, secret, { window: 1 });
    if (delta === null) {
      throw new UnprocessableEntityException('Invalid TOTP code');
    }

    const { plain, records } = await this.generateRecoveryCodes();
    await this.usersService.update(userId, {
      mfaRecoveryCodes: records,
      recoveryCodesShownOnce: true,
    });

    this.logger.log(`Recovery codes regenerated for user ${userId}`);
    return { recoveryCodes: plain };
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

    // Allow password reset regardless of MFA status
    // This is critical for account recovery when users lose MFA device
    // SECURITY: This allows attackers who compromise email to bypass MFA.
    // Mitigations:
    //   - Notify user of password reset via email.
    //   - Require MFA re-setup after password reset by clearing MFA secret.

    // Update password and clear MFA secret
    await this.usersService.update(String(record.userId), {
      password: newPassword,
      mfaSecret: null, // Require user to re-setup MFA
    });

    // cleanup
    await this.passwordResetModel.deleteOne({ _id: record._id }).exec();

    // Fetch user email for notification
    const user = await this.usersService.findOne(String(record.userId));
    if (user && user.email) {
      await this.emailService.send({
        to: user.email,
        subject: 'Your password was reset',
        text: `Your password was successfully reset. If you did not perform this action, please contact support immediately.`,
        html: `<p>Your password was successfully reset.</p><p>If you did not perform this action, please contact support immediately.</p>`,
      });
    }
    this.logger.log(
      `Password reset successful for user ${String(record.userId)}`,
    );
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

  // Lightweight user fetch for controller /auth/me
  async getUser(userId: string): Promise<UserDocument | null> {
    const user = await this.usersService.findOne(userId);
    return user as unknown as UserDocument | null; // cast due to Mongoose lean/document typing mismatch
  }
}
