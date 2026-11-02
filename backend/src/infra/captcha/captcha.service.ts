import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Xác thực CAPTCHA (Cloudflare Turnstile) cho endpoint public.
 *
 * Không cấu hình `TURNSTILE_SECRET_KEY` → bỏ qua (môi trường dev/test).
 * Bật ở production bằng cách đặt secret; client gửi `turnstileToken` trong form.
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('TURNSTILE_SECRET_KEY'));
  }

  async verify(token: unknown, ip?: string | null): Promise<void> {
    if (!this.enabled) return;

    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('Thiếu CAPTCHA — vui lòng xác thực trước khi nộp hồ sơ');
    }

    const body = new URLSearchParams({
      secret: this.config.get<string>('TURNSTILE_SECRET_KEY')!,
      response: token.trim(),
    });
    if (ip) body.set('remoteip', ip);

    try {
      const response = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5_000),
      });
      const result = (await response.json()) as { success?: boolean };
      if (!result.success) {
        throw new BadRequestException('CAPTCHA không hợp lệ hoặc đã hết hạn');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `Không xác thực được CAPTCHA: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Không xác thực được CAPTCHA, vui lòng thử lại');
    }
  }
}
