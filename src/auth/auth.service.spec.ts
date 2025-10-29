import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { Model } from 'mongoose';
import { PasswordResetDocument } from './schemas/password-reset.schema';
import { PendingMfaSetupDocument } from './schemas/pending-mfa-setup.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';

jest.mock('../utils/hash', () => ({
  compare: jest.fn(),
  hash: jest.fn(async (value: string) => `hashed:${value}`),
}));

import { compare, hash } from '../utils/hash';

describe('AuthService', () => {
  const createService = () => {
    const usersServiceMock = {
      findByEmail: jest.fn(),
      addRefreshToken: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      clearMfaSecret: jest.fn(),
    };

    const jwtServiceMock = {
      sign: jest.fn(),
    };

    const configValues: Record<string, string | undefined> = {
      JWT_SECRET: 'unit-test-secret',
      JWT_PRE_AUTH_EXPIRES_IN: '6m',
      MFA_SECRET_ENC_KEY: 'unit-mfa-key',
    };

    const configServiceMock = {
      get: jest.fn((key: string) => configValues[key]),
    };

    const emailService = {} as EmailService;
    const passwordResetModel = {} as Model<PasswordResetDocument>;
    const pendingMfaExecMock = jest.fn().mockResolvedValue(null);
    const pendingMfaFindOneExec = jest.fn();
    const pendingMfaDeleteExec = jest.fn().mockResolvedValue({});
    const pendingMfaModelMock = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: pendingMfaExecMock }),
      findOne: jest.fn().mockReturnValue({ exec: pendingMfaFindOneExec }),
      deleteOne: jest.fn().mockReturnValue({ exec: pendingMfaDeleteExec }),
    };

    const service = new AuthService(
      usersServiceMock as unknown as UsersService,
      jwtServiceMock as unknown as JwtService,
      configServiceMock as unknown as ConfigService,
      emailService,
      passwordResetModel,
      pendingMfaModelMock as unknown as Model<PendingMfaSetupDocument>,
    );

    return {
      service,
      usersService: usersServiceMock,
      jwtService: jwtServiceMock,
      configService: configServiceMock,
      pendingMfaModel: pendingMfaModelMock,
      pendingMfaExec: pendingMfaExecMock,
      pendingMfaFindOneExec,
      pendingMfaDeleteExec,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (compare as jest.Mock).mockReset();
    (hash as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateUser', () => {
    it('returns user when credentials are valid', async () => {
      const { service, usersService } = createService();
      const user = {
        _id: '1',
        passwordHash: 'hashed',
      } as unknown as UserDocument;
      usersService.findByEmail.mockResolvedValue(user);
      (compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'dev@example.com',
        'password123',
      );

      expect(result).toBe(user);
      expect(usersService.findByEmail).toHaveBeenCalledWith('dev@example.com');
      expect(compare).toHaveBeenCalledWith('password123', 'hashed');
    });

    it('returns null when user does not exist', async () => {
      const { service, usersService } = createService();
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(
        'missing@example.com',
        'irrelevant',
      );

      expect(result).toBeNull();
      expect(compare).not.toHaveBeenCalled();
    });

    it('returns null when password is invalid', async () => {
      const { service, usersService } = createService();
      const user = {
        _id: '1',
        passwordHash: 'hashed',
      } as unknown as UserDocument;
      usersService.findByEmail.mockResolvedValue(user);
      (compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('dev@example.com', 'wrong');

      expect(result).toBeNull();
      expect(compare).toHaveBeenCalledWith('wrong', 'hashed');
    });
  });

  describe('login', () => {
    it('responds with requiresMfa true when MFA already enabled', async () => {
      const { service } = createService();
      const user = {
        _id: '507f191e810c19729de860ea',
        mfaEnabled: true,
      } as unknown as UserDocument;

      const result = await service.login(user);

      expect(result).toEqual({
        requiresMfa: true,
        userId: '507f191e810c19729de860ea',
      });
    });

    it('issues a scoped pre-auth token when MFA is not yet enabled', async () => {
      const { service, jwtService, configService } = createService();
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'another-secret';
        if (key === 'JWT_PRE_AUTH_EXPIRES_IN') return '5m';
        return undefined;
      });
      jwtService.sign.mockReturnValue('test-pre-auth-token');

      const user = {
        _id: '64fcd8189d1bd2d340535111',
        mfaEnabled: false,
      } as unknown as UserDocument;

      const result = await service.login(user);

      expect(result).toEqual({
        requiresMfaSetup: true,
        preAuthToken: 'test-pre-auth-token',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: '64fcd8189d1bd2d340535111',
          scope: ['mfa:setup'],
          type: 'pre-auth',
        },
        {
          secret: 'another-secret',
          expiresIn: '5m',
        },
      );
    });
  });

  describe('initTotpSetup', () => {
    it('stores a pending secret and returns otpauth metadata', async () => {
      const { service, usersService, pendingMfaModel, pendingMfaExec } =
        createService();

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
      } as unknown as UserDocument);

      jest
        .spyOn(authenticator, 'generateSecret')
        .mockReturnValue('SECRETKEY123');
      jest
        .spyOn(authenticator, 'keyuri')
        .mockImplementation(
          (account: string, issuer: string, secret: string) =>
            `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`,
        );
      jest
        .spyOn<typeof qrcode, 'toString'>(qrcode, 'toString')
        .mockImplementation(() => Promise.resolve('<svg>mock</svg>'));

      const result = await service.initTotpSetup('user-id');

      expect(usersService.findOne).toHaveBeenCalledWith('user-id');
      expect(pendingMfaModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-id' },
        expect.objectContaining({
          secret: 'SECRETKEY123',
          expiresAt: expect.any(Date),
        }),
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
      expect(pendingMfaExec).toHaveBeenCalled();

      const totpUrl = new URL(result.otpauthUrl);
      expect(totpUrl.protocol).toBe('otpauth:');
      expect(totpUrl.hostname).toBe('totp');
      expect(totpUrl.pathname.slice(1)).toBe('RojasSolutions:dev@example.com');
      expect(totpUrl.searchParams.get('secret')).toBe('SECRETKEY123');
      expect(totpUrl.searchParams.get('issuer')).toBe('RojasSolutions');

      expect(result.qrSvgDataUrl).toBe(
        `data:image/svg+xml;base64,${Buffer.from('<svg>mock</svg>').toString('base64')}`,
      );
    });
  });

  describe('verifyTotpSetup', () => {
    it('activates MFA, stores encrypted secret, and returns tokens with recovery codes', async () => {
      const {
        service,
        usersService,
        jwtService,
        pendingMfaModel,
        pendingMfaFindOneExec,
        pendingMfaDeleteExec,
      } = createService();

      pendingMfaFindOneExec.mockResolvedValue({
        userId: 'user-id',
        secret: 'SECRETKEY123',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const randomSpy = jest
        .spyOn(crypto, 'randomBytes')
        .mockImplementation((size: number) => {
          if (size === 32) {
            return Buffer.alloc(size, 1);
          }
          const base = `code${size}`.padEnd(size, 'x');
          return Buffer.from(base);
        });

      jest
        .spyOn(authenticator, 'checkDelta')
        .mockReturnValue({ delta: 0 } as any);

      jwtService.sign.mockReturnValue('signed-access-token');

      usersService.update.mockResolvedValue({
        _id: 'user-id',
      } as unknown as UserDocument);

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
        role: 'employee',
        mfaEnabled: true,
      } as unknown as UserDocument);

      const result = await service.verifyTotpSetup('user-id', '123456');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-id',
          email: 'dev@example.com',
        }),
        expect.objectContaining({ secret: 'unit-test-secret' }),
      );

      const updatePayload = usersService.update.mock.calls[0][1];
      expect(updatePayload).toMatchObject({
        mfaEnabled: true,
        recoveryCodesShownOnce: false,
      });
      expect(updatePayload.mfaSecretEnc).toEqual(expect.any(String));
      expect(updatePayload.mfaRecoveryCodes).toHaveLength(10);
      updatePayload.mfaRecoveryCodes.forEach(
        (entry: { codeHash: string; codeEnc: string; usedAt: null }) => {
          expect(entry.codeHash).toMatch(/^hashed:/);
          expect(typeof entry.codeEnc).toBe('string');
          expect(entry.usedAt).toBeNull();
        },
      );
      expect(hash).toHaveBeenCalled();

      expect(pendingMfaModel.deleteOne).toHaveBeenCalledWith({
        userId: 'user-id',
      });
      expect(pendingMfaDeleteExec).toHaveBeenCalled();
      expect(usersService.clearMfaSecret).toHaveBeenCalledWith('user-id');

      expect(usersService.addRefreshToken).toHaveBeenCalledWith(
        'user-id',
        expect.any(String),
      );

      expect(result).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: expect.any(String),
        recoveryCodesShownOnce: false,
        recoveryCodes: expect.any(Array),
      });
      expect(result.recoveryCodes).toHaveLength(10);
      result.recoveryCodes.forEach((code: string) => {
        expect(code).toHaveLength(5 * 2); // hex string from 5 bytes
      });

      randomSpy.mockRestore();
    });

    it('throws 422 when the provided code is invalid', async () => {
      const { service, pendingMfaFindOneExec } = createService();

      pendingMfaFindOneExec.mockResolvedValue({
        userId: 'user-id',
        secret: 'SECRETKEY123',
        expiresAt: new Date(Date.now() + 60_000),
      });

      jest.spyOn(authenticator, 'checkDelta').mockReturnValue(null);

      await expect(
        service.verifyTotpSetup('user-id', '000000'),
      ).rejects.toThrow('Invalid TOTP code');
    });

    it('throws when no pending setup exists', async () => {
      const { service, pendingMfaFindOneExec } = createService();

      pendingMfaFindOneExec.mockResolvedValue(null);

      await expect(
        service.verifyTotpSetup('user-id', '123456'),
      ).rejects.toThrow('MFA setup expired');
    });
  });

  describe('verifyTotpLogin', () => {
    it('issues tokens on valid TOTP code and clears attempts', async () => {
      const { service, usersService, jwtService } = createService();
      const encrypt = (
        service as unknown as {
          encryptValue: (value: string) => string;
        }
      ).encryptValue.bind(service as any);
      const secretEnc = encrypt('SECRET123');

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
        role: 'employee',
        mfaEnabled: true,
        mfaSecretEnc: secretEnc,
      } as unknown as UserDocument);

      jest
        .spyOn(authenticator, 'checkDelta')
        .mockReturnValue({ delta: 0 } as any);
      jwtService.sign.mockReturnValue('totp-access');
      usersService.addRefreshToken.mockResolvedValue(undefined);

      const result = await service.verifyTotpLogin(
        'user-id',
        '123456',
        '127.0.0.1',
      );

      expect(result).toEqual({
        accessToken: 'totp-access',
        refreshToken: expect.any(String),
      });
      expect(usersService.addRefreshToken).toHaveBeenCalledWith(
        'user-id',
        expect.any(String),
      );
    });

    it('throws 422 on invalid TOTP code', async () => {
      const { service, usersService } = createService();
      const encrypt = (
        service as unknown as {
          encryptValue: (value: string) => string;
        }
      ).encryptValue.bind(service as any);
      const secretEnc = encrypt('SECRET123');

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
        role: 'employee',
        mfaEnabled: true,
        mfaSecretEnc: secretEnc,
      } as unknown as UserDocument);

      jest.spyOn(authenticator, 'checkDelta').mockReturnValue(null);

      await expect(
        service.verifyTotpLogin('user-id', '000000', '127.0.0.1'),
      ).rejects.toThrow('Invalid TOTP code');
    });

    it('rate limits repeated attempts', async () => {
      const { service, usersService } = createService();
      const encrypt = (
        service as unknown as {
          encryptValue: (value: string) => string;
        }
      ).encryptValue.bind(service as any);
      const secretEnc = encrypt('SECRET123');

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
        role: 'employee',
        mfaEnabled: true,
        mfaSecretEnc: secretEnc,
      } as unknown as UserDocument);

      jest.spyOn(authenticator, 'checkDelta').mockReturnValue(null);

      const attempt = () =>
        service.verifyTotpLogin('user-id', '000000', '127.0.0.1');

      for (let i = 0; i < 5; i += 1) {
        await expect(attempt()).rejects.toThrow('Invalid TOTP code');
      }

      await expect(attempt()).rejects.toThrow('Too many MFA attempts');
    });
  });

  describe('recoveryLogin', () => {
    it('logs in with a valid unused recovery code', async () => {
      const { service, usersService, jwtService } = createService();
      const encrypt = (
        service as unknown as {
          encryptValue: (value: string) => string;
        }
      ).encryptValue.bind(service as any);
      const code = 'recover1';
      const codeEnc = encrypt(code);
      const codeHash = `hashed:${code}`;

      usersService.findByEmail.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
        role: 'employee',
        mfaEnabled: true,
        mfaRecoveryCodes: [{ codeHash, codeEnc, usedAt: null }],
      } as unknown as UserDocument);

      (compare as jest.Mock).mockImplementation(
        (plain: string, hashedVal: string) =>
          Promise.resolve(`hashed:${plain}` === hashedVal),
      );
      jwtService.sign.mockReturnValue('recovery-access');
      usersService.addRefreshToken.mockResolvedValue(undefined);

      const result = await service.recoveryLogin(
        'dev@example.com',
        code,
        '127.0.0.1',
      );

      expect(result).toEqual({
        accessToken: 'recovery-access',
        refreshToken: expect.any(String),
      });
      expect(usersService.update).toHaveBeenCalledWith('user-id', {
        mfaRecoveryCodes: [{ codeHash, codeEnc, usedAt: expect.any(Date) }],
        recoveryCodesShownOnce: true,
      });
    });

    it('rejects already used recovery codes', async () => {
      const { service, usersService } = createService();
      usersService.findByEmail.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
        role: 'employee',
        mfaEnabled: true,
        mfaRecoveryCodes: [
          { codeHash: 'hashed:recover', codeEnc: 'enc', usedAt: new Date() },
        ],
      } as unknown as UserDocument);

      (compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.recoveryLogin('dev@example.com', 'recover', '127.0.0.1'),
      ).rejects.toThrow('Recovery code already used');
    });

    it('rejects invalid recovery codes', async () => {
      const { service, usersService } = createService();
      usersService.findByEmail.mockResolvedValue({
        _id: 'user-id',
        email: 'dev@example.com',
        role: 'employee',
        mfaEnabled: true,
        mfaRecoveryCodes: [
          { codeHash: 'hashed:recover', codeEnc: 'enc', usedAt: null },
        ],
      } as unknown as UserDocument);

      (compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.recoveryLogin('dev@example.com', 'invalid', '127.0.0.1'),
      ).rejects.toThrow('Invalid recovery code');
    });
  });

  describe('getRecoveryCodes', () => {
    it('returns decrypted codes when not yet retrieved', async () => {
      const { service, usersService } = createService();
      const encrypt = (
        service as unknown as {
          encryptValue: (value: string) => string;
        }
      ).encryptValue.bind(service as any);

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        mfaEnabled: true,
        recoveryCodesShownOnce: false,
        mfaRecoveryCodes: [
          { codeHash: 'hashed:code', codeEnc: encrypt('code'), usedAt: null },
        ],
      } as unknown as UserDocument);

      const result = await service.getRecoveryCodes('user-id');

      expect(result).toEqual({
        recoveryCodes: [{ code: 'code', usedAt: null }],
      });
      expect(usersService.update).toHaveBeenCalledWith('user-id', {
        recoveryCodesShownOnce: true,
      });
    });

    it('throws when codes already retrieved', async () => {
      const { service, usersService } = createService();
      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        mfaEnabled: true,
        recoveryCodesShownOnce: true,
        mfaRecoveryCodes: [],
      } as unknown as UserDocument);

      await expect(service.getRecoveryCodes('user-id')).rejects.toThrow(
        'Recovery codes already retrieved',
      );
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('generates new codes after verifying TOTP', async () => {
      const { service, usersService } = createService();
      const encrypt = (
        service as unknown as {
          encryptValue: (value: string) => string;
        }
      ).encryptValue.bind(service as any);
      const secretEnc = encrypt('SECRET123');

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        mfaEnabled: true,
        mfaSecretEnc: secretEnc,
        email: 'dev@example.com',
        role: 'employee',
      } as unknown as UserDocument);

      jest
        .spyOn(authenticator, 'checkDelta')
        .mockReturnValue({ delta: 0 } as any);

      const randomSpy = jest
        .spyOn(crypto, 'randomBytes')
        .mockImplementation((size: number) => {
          if (size === 32) {
            return Buffer.alloc(size, 2);
          }
          const base = `regen${size}`.padEnd(size, 'y');
          return Buffer.from(base);
        });

      const result = await service.regenerateRecoveryCodes('user-id', '123456');

      expect(result.recoveryCodes).toHaveLength(10);
      expect(usersService.update).toHaveBeenCalledWith('user-id', {
        mfaRecoveryCodes: expect.any(Array),
        recoveryCodesShownOnce: true,
      });

      randomSpy.mockRestore();
    });

    it('fails when TOTP code invalid', async () => {
      const { service, usersService } = createService();
      const encrypt = (
        service as unknown as {
          encryptValue: (value: string) => string;
        }
      ).encryptValue.bind(service as any);
      const secretEnc = encrypt('SECRET123');

      usersService.findOne.mockResolvedValue({
        _id: 'user-id',
        mfaEnabled: true,
        mfaSecretEnc: secretEnc,
      } as unknown as UserDocument);

      jest.spyOn(authenticator, 'checkDelta').mockReturnValue(null);

      await expect(
        service.regenerateRecoveryCodes('user-id', '000000'),
      ).rejects.toThrow('Invalid TOTP code');
    });
  });
});
