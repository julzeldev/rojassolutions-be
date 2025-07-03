// src/auth/strategies/twofactor.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService } from '../auth.service';

/**
 * Strategy for verifying TOTP two-factor authentication codes.
 * Expects req.user (from JWT guard) and req.body.code.
 */
@Injectable()
export class TwoFactorStrategy extends PassportStrategy(Strategy, 'twofactor') {
  constructor(private readonly authService: AuthService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super();
  }

  async validate(req: Request): Promise<any> {
    const user = req.user as { sub: string };
    const code = (req.body as { code?: string }).code;

    if (!user || !user.sub) {
      throw new UnauthorizedException('User not authenticated');
    }
    if (!code) {
      throw new UnauthorizedException('2FA code missing');
    }

    // Delegates code verification to AuthService.verifyTwoFactor
    const isValid = await this.authService.verifyTwoFactor(user.sub, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    // If valid, attach user back to request for further handling
    return user;
  }
}
