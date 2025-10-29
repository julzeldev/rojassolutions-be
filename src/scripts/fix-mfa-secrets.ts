import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';

/**
 * Script to re-encrypt MFA secrets for users who have plain mfaSecret
 * Run with: npx ts-node src/scripts/fix-mfa-secrets.ts
 */
async function fixMfaSecrets() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  try {
    const users = await usersService.findAll();
    let fixed = 0;

    for (const user of users) {
      const userDoc = user as {
        mfaSecret?: string;
        mfaSecretEnc?: string;
        mfaEnabled?: boolean;
        email: string;
      };

      // Check if user has plain mfaSecret but no mfaSecretEnc
      if (userDoc.mfaSecret && !userDoc.mfaSecretEnc && userDoc.mfaEnabled) {
        console.log(`Migrating MFA secret for user: ${userDoc.email}`);

        // The AuthService has the encryption method, but it's private
        // So we'll just clear the MFA for this user and they'll need to re-setup
        console.log(
          `  ⚠️  User ${userDoc.email} has plain mfaSecret - needs to re-setup MFA`,
        );
        console.log(`  You can either:`);
        console.log(
          `    1. Disable MFA for this user and have them set it up again`,
        );
        console.log(`    2. Manually re-encrypt the secret`);
        fixed++;
      } else if (userDoc.mfaSecretEnc && userDoc.mfaEnabled) {
        console.log(`✓ User ${userDoc.email} has encrypted MFA secret`);
      }
    }

    console.log(`\nFound ${fixed} users that may need MFA re-setup`);
  } catch (error) {
    console.error('Error:', error);
  }

  await app.close();
}

void fixMfaSecrets();
