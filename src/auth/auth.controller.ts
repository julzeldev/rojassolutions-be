import {
  Controller,
  Post,
  Request,
  UseGuards,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
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
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('enable-mfa')
  async enableMfa(@Request() req: any) {
    // After JwtStrategy.validate, request.user is an auth payload, not a full UserDocument
    // Shape: { userId: string; email: string; role: string }
    const r = req as {
      user?: { userId?: string; email?: string; role?: string };
    };
    const authPayload = r.user;
    if (!authPayload?.userId) throw new UnauthorizedException();
    return this.authService.generateMfaSetup(authPayload.userId);
  }

  @Post('verify-mfa')
  async verifyMfa(@Body() body: VerifyMfaDto) {
    const { userId, token, purpose } = body;
    if (purpose === 'enable') {
      const ok = await this.authService.verifyMfaForEnable(userId, token);
      return { ok };
    }
    // default to login flow
    return this.authService.verifyMfaAndLogin(userId, token);
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
      hasMfaSecret: !!userDoc.mfaSecret,
    };
  }
}
