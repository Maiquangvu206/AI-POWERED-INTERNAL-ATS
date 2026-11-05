import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Xác thực JWT nếu request có Bearer token, nhưng vẫn cho phép ẩn danh.
 * Token có mặt nhưng sai/hết hạn sẽ bị từ chối (401) thay vì âm thầm coi là ẩn danh.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) return true;

    await super.canActivate(context);
    return true;
  }
}
