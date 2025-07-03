import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change_this_secret',
    });
  }

  /**
   * Validates the JWT payload and returns a user object attached to request.
   */
  validate(payload: JwtPayload): Promise<JwtPayload> {
    // Optionally, you could verify the user still exists in DB here.
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }
    return Promise.resolve(payload);
  }
}
