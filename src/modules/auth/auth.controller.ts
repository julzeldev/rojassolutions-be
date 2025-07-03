import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { TwoFactorDto } from './dtos/twofactor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Admin login: validate credentials and issue JWT
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Verify TOTP 2FA code (after initial login)
   * Protected by JWT guard: user must present a valid accessToken
   */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  verifyTwoFactor(
    @Request() req: { user: { sub: string } },
    @Body() twoFactorDto: TwoFactorDto,
  ): Promise<boolean> {
    return this.authService.verifyTwoFactor(req.user.sub, twoFactorDto.code);
  }
}
