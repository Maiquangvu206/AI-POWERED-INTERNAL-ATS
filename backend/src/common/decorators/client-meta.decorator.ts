import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Lấy IP + User-Agent của request để ghi vào `audit_logs`.
 * Không dùng cho logic nghiệp vụ — chỉ phục vụ truy vết.
 */
export const ClientMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientMeta => {
    const request = ctx.switchToHttp().getRequest<Request>();

    return {
      ip: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
    };
  },
);
