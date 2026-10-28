import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '@ats/shared';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  fullName: string;
  role: Role;
}

type RequestWithUser = Request & { user?: AuthenticatedUser };

/**
 * Lấy user đã được JwtStrategy gắn vào request.
 * @example findAll(@CurrentUser() user: AuthenticatedUser)
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
