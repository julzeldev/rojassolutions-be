import { Controller, Post, Request, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('enable-mfa')
  async enableMfa(@Request() req: any) {
    const request = req as { user?: unknown };
    if (!request.user)
      throw new (await import('@nestjs/common')).UnauthorizedException();
    const user =
      request.user as import('../users/schemas/user.schema').UserDocument;
    return this.authService.generateMfaSetup(String(user._id));
  }

  @Post('verify-mfa')
  async verifyMfa(
    @Body()
    body: {
      userId: string;
      token: string;
      purpose?: 'enable' | 'login';
    },
  ) {
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
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.logout(refreshToken);
    return { ok: true };
  }
}
