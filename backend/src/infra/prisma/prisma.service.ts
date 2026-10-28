import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Bọc PrismaClient trong Nest để quản lý vòng đời kết nối.
 * Đăng ký global ở PrismaModule → inject ở bất kỳ service nào.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Đã kết nối PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Dùng cho readiness probe. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        'Ping PostgreSQL thất bại',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
