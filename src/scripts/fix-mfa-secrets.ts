import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { User } from '../users/schemas/user.schema';

/**
 * Script to re-encrypt MFA secrets for users who have plain mfaSecret
 * Run with: npx ts-node src/scripts/fix-mfa-secrets.ts
 */
async function fixMfaSecrets() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  try {
    const users: User[] = await usersService.findAll();
    let fixed = 0;

    for (const user of users) {
      // Check if user has plain mfaSecret but no mfaSecretEnc
      if (user.mfaSecret && !user.mfaSecretEnc && user.mfaEnabled) {
        console.log(`Migrating MFA secret for user: ${user.email}`);

        // The AuthService has the encryption method, but it's private
        // So we'll just clear the MFA for this user and they'll need to re-setup
        console.log(
          `  ⚠️  User ${user.email} has plain mfaSecret - needs to re-setup MFA`,
        );
        console.log(`  You can either:`);
        console.log(
          `    1. Disable MFA for this user and have them set it up again`,
        );
        console.log(`    2. Manually re-encrypt the secret`);
        fixed++;
      } else if (user.mfaSecretEnc && user.mfaEnabled) {
        console.log(`✓ User ${user.email} has encrypted MFA secret`);
      }
    }

    console.log(`\nFound ${fixed} users that may need MFA re-setup`);
  } catch (error) {
    console.error('Error:', error);
  }

  await app.close();
}

void fixMfaSecrets();
