import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that applies the 'twofactor' Passport strategy to protect routes requiring 2FA.
 */
@Injectable()
export class TwoFactorGuard extends AuthGuard('twofactor') {}
