import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local authentication guard
 * Uses Passport's 'local' strategy to validate email and password
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
