import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validateEnv } from './config/env.validation';
import { CaptchaModule } from './infra/captcha/captcha.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueueModule } from './infra/queue/queue.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Thư mục backend/ nằm ngay dưới root repo → .env ở root là '../.env'
      // File .env trong backend/ (nếu có) được ưu tiên hơn
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
      cache: true,
    }),
    PrismaModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    CaptchaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    AuditModule,
    HealthModule,
    MailModule,
    AuthModule,
    AdminModule,
    CampaignsModule,
    CandidatesModule,
    EvaluationsModule,
    CopilotModule,
  ],
  providers: [
    // Chặn spam trước khi chạm DB; JWT/RBAC sau đó
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Thứ tự quan trọng: xác thực trước, phân quyền sau
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
