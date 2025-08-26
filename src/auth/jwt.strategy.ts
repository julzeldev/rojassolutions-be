import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { getJwtConfig } from './constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtConfig(configService).secret,
    });
  }

  validate(payload: unknown) {
    // payload contains sub, email, role
    const p = payload as { sub: string; email: string; role: string };
    // TEMP DEBUG LOG (remove after diagnosing 401s)
    // Using console.log directly so it appears in standard output
    // Include timestamp for correlation
    try {
      console.log('[JwtStrategy.validate]', new Date().toISOString(), p);
    } catch {
      /* ignore logging errors */
    }
    return { userId: p.sub, email: p.email, role: p.role };
  }
}
