import { ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface HealthResponse {
  status: 'ok';
  service: 'core-api';
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

/**
 * Liveness (`/health`) và Readiness (`/health/ready`).
 * Readiness trả 503 nếu DB không kết nối được → orchestrator ngừng route traffic.
 */
@ApiTags('system')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'core-api',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<{
    status: 'ok';
    checks: { database: 'up' };
    timestamp: string;
  }> {
    const dbUp = await this.prisma.ping();

    if (!dbUp) {
      throw new ServiceUnavailableException('Cơ sở dữ liệu chưa sẵn sàng');
    }

    return {
      status: 'ok',
      checks: { database: 'up' },
      timestamp: new Date().toISOString(),
    };
  }
}
