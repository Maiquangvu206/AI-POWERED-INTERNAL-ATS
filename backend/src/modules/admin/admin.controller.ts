import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Endpoint chẩn đoán dành riêng cho ADMIN — dùng để kiểm chứng RBAC.
 * Phase 2 sẽ thay bằng module quản trị thật (campaign, rubric, lock round).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  @Get('ping')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Kiểm tra quyền ADMIN (dùng cho smoke test RBAC)' })
  ping(@CurrentUser() user: AuthenticatedUser | undefined): {
    ok: true;
    role: string;
    email: string;
  } {
    return { ok: true, role: user?.role ?? 'UNKNOWN', email: user?.email ?? '' };
  }
}
