import { z } from 'zod';

/**
 * Validate biến môi trường lúc khởi động (fail-fast).
 * Sai cấu hình → app không boot, thay vì lỗi khó hiểu lúc runtime.
 */

/** `S3_FORCE_PATH_STYLE=false` phải ra `false` — `z.coerce.boolean()` sẽ biến mọi chuỗi khác rỗng thành true. */
const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(defaultValue)
    .transform((value) =>
      typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()),
    );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET phải dài tối thiểu 32 ký tự'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // --- Queue (ADR-0005) ------------------------------------------------------
  REDIS_URL: z.string().min(1, 'REDIS_URL là bắt buộc'),
  QUEUE_PREFIX: z.string().default('ats'),

  // --- AI Service ------------------------------------------------------------
  AI_SERVICE_URL: z
    .string()
    .url('AI_SERVICE_URL phải là URL hợp lệ')
    .default('http://localhost:8010'),
  AI_INTERNAL_TOKEN: z.string().default(''),

  // --- Object storage S3-compatible (ADR-0006) -------------------------------
  S3_ENDPOINT: z.string().url('S3_ENDPOINT phải là URL hợp lệ'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY là bắt buộc'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY là bắt buộc'),
  S3_BUCKET_CV: z.string().min(3).default('cv-files'),
  S3_FORCE_PATH_STYLE: envBoolean(true),
  S3_SIGNED_URL_TTL: z.coerce.number().int().min(30).max(3600).default(300),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('debug'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`❌ Cấu hình môi trường không hợp lệ:\n${details}`);
  }

  return parsed.data;
}
