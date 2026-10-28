import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Bỏ dấu tiếng Việt → slug ASCII, an toàn cho URL. */
export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);

  return base || 'campaign';
}

/**
 * Chuẩn hoá ngày về 00:00 UTC — cột Prisma là `@db.Date`.
 * Nhận cả `YYYY-MM-DD` và ISO đầy đủ; từ chối chuỗi rác.
 */
export function parseDateOnly(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} không phải ngày hợp lệ`);
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2003' || error.code === 'P2014')
  );
}

export function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Tổng weight của rubric — phải bằng 1.000 ± 0.001 trước khi vòng chuyển IN_PROGRESS. */
export const WEIGHT_TOLERANCE = 0.001;

export function sumWeights(items: ReadonlyArray<{ weight: unknown }>): number {
  return items.reduce((total, item) => total + Number(item.weight), 0);
}

export function assertCampaignFound<T>(campaign: T | null, id?: number): T {
  if (!campaign) {
    throw new NotFoundException(
      id === undefined ? 'Chiến dịch không tồn tại' : `Không tìm thấy chiến dịch #${id}`,
    );
  }
  return campaign;
}
