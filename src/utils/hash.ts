import bcrypt from 'bcryptjs';

/**
 * Hashes a plain-text string (e.g., password or PIN).
 * @param data - The plain-text string to hash.
 * @returns The bcrypt hash.
 */
export async function hash(data: string): Promise<string> {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(data, salt);
}

/**
 * Compares a plain-text string against a bcrypt hash.
 * @param data - The plain-text string.
 * @param hashed - The bcrypt hash to compare against.
 * @returns True if the data matches the hash.
 */
export function compare(data: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(data, hashed);
}
