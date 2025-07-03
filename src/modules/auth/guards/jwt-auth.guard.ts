import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard
 * Uses Passport's 'jwt' strategy to validate access tokens
 */
@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class JwtAuthGuard extends AuthGuard('jwt') {}
