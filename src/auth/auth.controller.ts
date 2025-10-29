import {
  Controller,
  Post,
  Get,
  Request,
  UseGuards,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyTotpSetupDto } from './dto/verify-totp-setup.dto';
import { VerifyTotpLoginDto } from './dto/verify-totp-login.dto';
import { RecoveryLoginDto } from './dto/recovery-login.dto';
import { RegenRecoveryCodesDto } from './dto/regen-recovery-codes.dto';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiUnprocessableEntityResponse,
  ApiTooManyRequestsResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { PreAuthGuard } from './guards/pre-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['requiresMfa', 'userId'],
          properties: {
            requiresMfa: { type: 'boolean', enum: [true] },
            userId: { type: 'string', description: 'Identifier to verify MFA' },
          },
        },
        {
          type: 'object',
          required: ['requiresMfaSetup', 'preAuthToken'],
          properties: {
            requiresMfaSetup: {
              type: 'boolean',
              enum: [true],
            },
            preAuthToken: {
              type: 'string',
              description:
                'Short-lived token limited to MFA setup endpoints (5–10 minutes)',
            },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Post('login')
  async login(@Request() req: any) {
    const request = req as { user?: unknown };
    if (!request.user) {
      // LocalAuthGuard should have populated request.user
      throw new (await import('@nestjs/common')).UnauthorizedException();
    }
    const user =
      request.user as import('../users/schemas/user.schema').UserDocument;
    return this.authService.login(user);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return await this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(PreAuthGuard)
  @Post('mfa/totp/init')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start TOTP setup with a pre-auth token' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['otpauthUrl', 'qrSvgDataUrl'],
      properties: {
        otpauthUrl: {
          type: 'string',
          description:
            'Key URI for TOTP applications (includes issuer/account)',
        },
        qrSvgDataUrl: {
          type: 'string',
          description:
            'SVG data URL representing the QR code for the otpauth URL',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Pre-auth token missing, expired, or scope invalid',
  })
  async initTotp(@Request() req: any) {
    const payload = req as {
      user?: { userId?: string };
    };
    const userId = payload.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.authService.initTotpSetup(userId);
  }

  @Post('mfa/totp/verify')
  @Throttle({
    default: {
      limit: 5,
      ttl: 60,
      getTracker: (req: any) => `${req?.body?.userId || 'unknown'}:${req.ip}`,
    },
  })
  @ApiOperation({ summary: 'Complete MFA login with a TOTP code' })
  @ApiBody({ type: VerifyTotpLoginDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['accessToken', 'refreshToken'],
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'User session invalid or MFA not enabled',
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid TOTP code' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts' })
  async verifyTotp(@Body() body: VerifyTotpLoginDto, @Request() req: any) {
    const ip = (req as { ip?: string; socket?: { remoteAddress?: string } }).ip;
    const fallbackIp = (req as { socket?: { remoteAddress?: string } }).socket
      ?.remoteAddress;
    return this.authService.verifyTotpLogin(
      body.userId,
      body.code,
      ip || fallbackIp || 'unknown',
    );
  }

  @Post('mfa/recovery-login')
  @Throttle({
    default: {
      limit: 5,
      ttl: 600,
      getTracker: (req: any) => `${req?.body?.email || 'unknown'}:${req.ip}`,
    },
  })
  @ApiOperation({ summary: 'Login using a recovery code' })
  @ApiBody({ type: RecoveryLoginDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['accessToken', 'refreshToken'],
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or MFA not enabled',
  })
  @ApiUnprocessableEntityResponse({ description: 'Recovery code already used' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts' })
  async recoveryLogin(@Body() body: RecoveryLoginDto, @Request() req: any) {
    const ip = (req as { ip?: string; socket?: { remoteAddress?: string } }).ip;
    const fallbackIp = (req as { socket?: { remoteAddress?: string } }).socket
      ?.remoteAddress;
    return this.authService.recoveryLogin(
      body.email,
      body.recoveryCode,
      ip || fallbackIp || 'unknown',
    );
  }

  @UseGuards(PreAuthGuard)
  @Post('mfa/totp/verify-setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify TOTP setup code and activate MFA' })
  @ApiBody({ type: VerifyTotpSetupDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: [
        'accessToken',
        'refreshToken',
        'recoveryCodes',
        'recoveryCodesShownOnce',
      ],
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        recoveryCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Plain recovery codes shown once to the user',
        },
        recoveryCodesShownOnce: {
          type: 'boolean',
          enum: [true],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Pre-auth token invalid or expired' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid TOTP code' })
  async verifyTotpSetup(@Request() req: any, @Body() body: VerifyTotpSetupDto) {
    const payload = req as {
      user?: { userId?: string };
    };
    const userId = payload.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.authService.verifyTotpSetup(userId, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mfa/recovery-codes')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve recovery codes once after setup or regeneration',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['recoveryCodes'],
      properties: {
        recoveryCodes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['code', 'usedAt'],
            properties: {
              code: { type: 'string' },
              usedAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Codes already retrieved' })
  async getRecoveryCodes(@Request() req: any) {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.authService.getRecoveryCodes(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/recovery-codes/regen')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate recovery codes after confirming TOTP' })
  @ApiBody({ type: RegenRecoveryCodesDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['recoveryCodes'],
      properties: {
        recoveryCodes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'User session invalid or MFA not enabled',
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid TOTP code' })
  async regenRecoveryCodes(
    @Request() req: any,
    @Body() body: RegenRecoveryCodesDto,
  ) {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.authService.regenerateRecoveryCodes(userId, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto.refreshToken);
    return { ok: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async me(@Request() req: any) {
    const payload = (req as { user?: { userId?: string } }).user;
    if (!payload?.userId) throw new UnauthorizedException();
    const userDoc = (await this.authService.getUser(
      payload.userId,
    )) as unknown as {
      _id?: string;
      id?: string;
      email: string;
      role: string;
      mfaEnabled?: boolean;
      mfaSecret?: string;
    };
    const id = userDoc._id || userDoc.id || payload.userId;
    return {
      id: String(id),
      email: userDoc.email,
      role: userDoc.role,
      mfaEnabled: !!userDoc.mfaEnabled,
      hasMfaSecret: !!(
        userDoc.mfaSecret ||
        (userDoc as unknown as { mfaSecretEnc?: string }).mfaSecretEnc
      ),
    };
  }
}
