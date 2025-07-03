import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

import { Admin, AdminDocument } from '../admin/schemas/admin.schema';
import { LoginDto } from './dtos/login.dto';
import { compare } from '../../utils/hash';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates admin credentials (email + password).
   * Now returns the full Mongoose document (with `_id`).
   */
  async validateAdmin(email: string, password: string): Promise<AdminDocument> {
    const admin = await this.adminModel.findOne({ email }).exec();
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordMatches = await compare(password, admin.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return admin;
  }

  /**
   * Performs login: validates credentials, then issues a JWT.
   */
  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    const admin = await this.validateAdmin(loginDto.email, loginDto.password);

    const payload: JwtPayload = {
      sub: (admin._id as Types.ObjectId).toHexString(),
      email: admin.email,
      role: 'admin',
    };

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      accessToken: this.jwtService.sign(payload) as string,
    };
  }

  /**
   * Verifies the TOTP 2FA code for a given user.
   * @param userId - The ID of the user.
   * @param code - The TOTP code to verify.
   * @returns True if the code is valid, otherwise false.
   */
  async verifyTwoFactor(userId: string, code: string): Promise<boolean> {
    // Simulate verification logic
    const isValid = await Promise.resolve(code === '123456'); // Example logic
    return isValid;
  }
}
