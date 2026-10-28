import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  data: T;
  meta: { requestId: string; timestamp: string };
}

/**
 * Bọc mọi response thành công vào `{ data, meta }`.
 * Lỗi đã được AllExceptionsFilter xử lý riêng (RFC 7807).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: (request.headers['x-request-id'] as string | undefined) ?? '-',
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
