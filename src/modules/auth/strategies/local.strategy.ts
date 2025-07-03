import { Strategy } from 'passport-local';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { AdminDocument } from '../../admin/schemas/admin.schema';

/**
 * Local strategy for admin authentication using email and password.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    // Configure to use 'email' instead of default 'username'
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({ usernameField: 'email', passwordField: 'password' });
  }

  /**
   * Called by Passport to validate credentials.
   * Returns the admin document on success.
   */
  async validate(
    email: string,
    password: string,
  ): Promise<Omit<AdminDocument, 'password'>> {
    const admin = await this.authService.validateAdmin(email, password);
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const adminObject = admin.toObject() as AdminDocument;
    const result = { ...adminObject };
    delete (result as { password?: string }).password;
    return result as unknown as Omit<AdminDocument, 'password'>;
  }
}
