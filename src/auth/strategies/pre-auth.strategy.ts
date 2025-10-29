import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtConfig } from '../constants';

interface PreAuthJwtPayload {
  sub: string;
  scope?: string[];
  type?: string;
}

@Injectable()
export class PreAuthStrategy extends PassportStrategy(Strategy, 'pre-auth') {
  constructor(configService: ConfigService) {
    const cfg = getJwtConfig(configService);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.secret,
    });
  }

  validate(payload: PreAuthJwtPayload) {
    if (payload.type !== 'pre-auth') {
      throw new UnauthorizedException('Invalid pre-auth token');
    }
    if (!payload.scope || !payload.scope.includes('mfa:setup')) {
      throw new UnauthorizedException('Insufficient scope for MFA setup');
    }
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid payload');
    }

    return {
      userId: payload.sub,
      scope: payload.scope,
    };
  }
}
