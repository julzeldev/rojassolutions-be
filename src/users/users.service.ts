import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hash } from '../utils/hash';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private readonly logger = new Logger(UsersService.name);

  async onApplicationBootstrap(): Promise<void> {
    // run seeding on bootstrap
    try {
      await this.seedAdmins();
    } catch (err) {
      this.logger.error('seedAdmins failed', err);
    }
  }

  /**
   * Ensures a set of admin users exist. If a user is missing, create with a
   * random temporary password (logged to console) and enable MFA with a random secret.
   */
  async seedAdmins(): Promise<void> {
    const emails = [
      'nathy.mr26@gmail.com',
      'danielrojasb86@gmail.com',
      'julio.zeledon.developer@gmail.com',
    ];

    for (const email of emails) {
      const existing = await this.findByEmail(email);
      if (existing) {
        this.logger.log(`Admin exists: ${email}`);
        continue;
      }

      const tempPassword = randomBytes(12).toString('base64');
      const passwordHash = await hash(tempPassword);
      const mfaSecret = randomBytes(20).toString('hex');

      await this.userModel.create({
        email,
        passwordHash,
        role: 'admin',
        mfaEnabled: true,
        mfaSecret,
      });
    }
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const passwordHash = await hash(createUserDto.password);
    const created = new this.userModel({
      email: createUserDto.email,
      passwordHash,
      role: createUserDto.role ?? 'employee',
    });
    return created.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findOne(id: string): Promise<User> {
    const u = await this.userModel.findById(id).exec();
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async addRefreshToken(userId: string, token: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $push: { refreshTokens: token } })
      .exec();
  }

  async findByRefreshToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ refreshTokens: token }).exec();
  }

  async removeRefreshToken(token: string): Promise<void> {
    await this.userModel
      .updateOne({ refreshTokens: token }, { $pull: { refreshTokens: token } })
      .exec();
  }

  async updateMfaSecret(userId: string, secret: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { mfaSecret: secret })
      .exec();
  }

  async clearMfaSecret(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $unset: { mfaSecret: '' } })
      .exec();
  }

  async update(id: string, update: UpdateUserDto): Promise<User> {
    const payload: UpdateQuery<UserDocument> = {};
    if (update.email) payload.email = update.email;
    if (update.role) payload.role = update.role;
    if (typeof update.mfaEnabled !== 'undefined')
      payload.mfaEnabled = !!update.mfaEnabled;
    if (typeof update.mfaSecret !== 'undefined')
      payload.mfaSecret = update.mfaSecret;
    if (typeof update.mfaSecretEnc !== 'undefined')
      payload.mfaSecretEnc = update.mfaSecretEnc as string | undefined;
    if (typeof update.mfaRecoveryCodes !== 'undefined')
      payload.mfaRecoveryCodes = update.mfaRecoveryCodes as string[] | undefined;
    if (typeof update.recoveryCodesShownOnce !== 'undefined')
      payload.recoveryCodesShownOnce = !!update.recoveryCodesShownOnce;
    if (update.password) {
      payload.passwordHash = await hash(update.password);
    }

    const updated = await this.userModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const res = await this.userModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('User not found');
  }
}
