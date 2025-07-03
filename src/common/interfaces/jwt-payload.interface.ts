/**
 * JWT payload interface for authenticated users.
 */
export interface JwtPayload {
  /** Subject: the user’s unique identifier */
  sub: string;

  /** The user’s email address */
  email: string;

  /** The user’s role (e.g., 'admin' or 'employee') */
  role: 'admin' | 'employee';

  /** Issued at timestamp (optional) */
  iat?: number;

  /** Expiration timestamp (optional) */
  exp?: number;
}
