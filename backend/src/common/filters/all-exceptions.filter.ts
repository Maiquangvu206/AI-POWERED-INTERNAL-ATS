import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code?: string;
  errors?: unknown;
  timestamp: string;
}

/**
 * Chuẩn hoá mọi lỗi về RFC 7807 `application/problem+json`.
 * Không bao giờ trả stack trace cho client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = isHttp ? exception.getResponse() : null;
    const detail = this.extractDetail(raw, exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${detail}`);
    }

    const body: ProblemDetails = {
      type: `https://httpstatuses.io/${status}`,
      title: HttpStatus[status] ?? 'Error',
      status,
      detail,
      instance: request.url,
      timestamp: new Date().toISOString(),
    };

    // ValidationPipe của Nest trả { message: string[], error, statusCode }
    if (raw && typeof raw === 'object' && 'errors' in raw) {
      body.errors = (raw as { errors: unknown }).errors;
    }
    if (raw && typeof raw === 'object' && 'code' in raw) {
      body.code = String((raw as { code: unknown }).code);
    }

    response.status(status).type('application/problem+json').json(body);
  }

  private extractDetail(raw: string | object | null, exception: unknown): string {
    if (typeof raw === 'string') return raw;

    if (raw && typeof raw === 'object' && 'message' in raw) {
      const message = (raw as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join('; ') : message;
    }

    if (exception instanceof Error) return exception.message;

    return 'Đã xảy ra lỗi không xác định';
  }
}
