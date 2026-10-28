import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CV_PROCESSING_DLQ, CV_PROCESSING_QUEUE } from './queue.constants';
import { CvProcessingProcessor } from './cv-processing.processor';

interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  tls?: Record<string, never>;
  /** BullMQ yêu cầu `null`: worker dùng blocking command, không được timeout. */
  maxRetriesPerRequest: null;
}

export function buildRedisConnection(redisUrl: string): RedisConnection {
  const url = new URL(redisUrl);
  const dbPath = url.pathname.replace(/^\//, '');

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: dbPath ? Number(dbPath) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        prefix: config.get<string>('QUEUE_PREFIX', 'ats'),
        connection: buildRedisConnection(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    BullModule.registerQueue({
      name: CV_PROCESSING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        // 5s, 10s, 20s… tránh dồn dập khi AI Service đang khởi động lại
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    BullModule.registerQueue({
      name: CV_PROCESSING_DLQ,
      defaultJobOptions: {
        // Không bao giờ tự xoá: job chết là bằng chứng cần điều tra
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
  ],
  providers: [CvProcessingProcessor],
  exports: [BullModule],
})
export class QueueModule {}
