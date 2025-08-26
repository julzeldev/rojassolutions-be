import { ConfigService } from '@nestjs/config';

export function getJwtConfig(config: ConfigService) {
  return {
    secret: config.get<string>('JWT_SECRET') || 'change_this_secret',
    expiresIn: config.get<string>('JWT_EXPIRES_IN') || '15m',
    refreshExpiresIn: config.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
  };
}
