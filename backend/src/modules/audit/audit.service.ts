import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditEntry {
  actorId?: number | null;
  /** Quy ước `<entity>.<action>` — ví dụ `campaign.status_change`. */
  action: string;
  entityType: string;
  entityId?: string | number | null;
  /** Ảnh chụp trước khi sửa (chỉ các trường thay đổi). */
  before?: unknown;
  /** Ảnh chụp sau khi sửa. */
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Ghi audit log append-only (ADR-0007).
 *
 * Bảng `audit_logs` bị trigger DB chặn UPDATE/DELETE, nên chỉ có một chiều ghi.
 * Lỗi ghi audit **không** được làm hỏng nghiệp vụ (ghi log lỗi rồi bỏ qua),
 * nhưng cũng không được im lặng — mọi thất bại đều vào application log.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId == null ? null : String(entry.entityId),
          before: toJson(entry.before),
          after: toJson(entry.after),
          ip: entry.ip?.slice(0, 45) ?? null,
          userAgent: entry.userAgent?.slice(0, 255) ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Không ghi được audit log "${entry.action}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

/** JSON round-trip để loại Date/undefined và khớp type `InputJsonValue`. */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
