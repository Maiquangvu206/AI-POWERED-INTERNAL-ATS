import { SetMetadata } from '@nestjs/common';
import type { Role } from '@ats/shared';

export const ROLES_KEY = 'roles';

/**
 * Giới hạn endpoint theo vai trò.
 * @example @Roles(Role.ADMIN)
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
