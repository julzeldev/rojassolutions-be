import { SetMetadata } from '@nestjs/common';

/**
 * Key under which roles metadata is stored.
 */
export const ROLES_KEY = 'roles';

/**
 * Roles decorator to specify which user roles have access to a route or controller.
 * @param roles - Array of roles permitted to access
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
