import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitResult {
  count: number;
  limit: number;
  allowed: boolean;
  /** Giây còn lại tới khi cửa sổ reset. */
  resetIn: number;
}

/**
 * Kết nối Redis dùng chung cho cache Copilot và bộ đếm rate limit.
 *
 * BullMQ có kết nối riêng; không tái sử dụng vì worker dùng blocking command
 * với `maxRetriesPerRequest: null`, còn cache/rate limit cần fail nhanh.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis lỗi: ${error.message}`);
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(`Không đọc được cache ${key}: ${this.describe(error)}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Không ghi được cache ${key}: ${this.describe(error)}`);
    }
  }

  /**
   * Đếm theo cửa sổ cố định (fixed window). Dùng `INCR` + `EXPIRE` nguyên tử
   * bằng Lua để tránh trường hợp key tăng mà không có TTL khi Redis restart.
   */
  async incrementWindow(key: string, ttlSeconds: number): Promise<number> {
    const script = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `;

    try {
      const count = (await this.client.eval(script, 1, key, ttlSeconds)) as number;
      return Number(count);
    } catch (error) {
      this.logger.warn(`Không đếm được rate limit ${key}: ${this.describe(error)}`);
      // Fail-open: lỗi hạ tầng không được chặn giám khảo/email hợp lệ.
      return 0;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch {
      return -1;
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
