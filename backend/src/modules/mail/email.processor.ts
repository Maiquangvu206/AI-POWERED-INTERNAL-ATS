import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue, UnrecoverableError, type Job } from 'bullmq';
import {
  EMAIL_DLQ,
  EMAIL_DLQ_JOB,
  EMAIL_JOB_VERSION,
  EMAIL_RATE_LIMIT_PER_HOUR,
  EMAIL_QUEUE,
} from '../../infra/queue/queue.constants';
import { RedisService } from '../../infra/redis/redis.service';
import { MailerService } from './mailer.service';
import type { EmailJobData } from './mail.service';
import { renderEmail } from './templates';

interface EmailProcessResult {
  ok: true;
  skipped?: boolean;
  reason?: string;
}

/**
 * Consumer của queue `email`.
 *
 * Rate limit theo ứng viên nằm ở worker (không phải producer) để mọi lần retry
 * đều được tính — tránh một job lỗi lặp lại 3 lần trong vài giây.
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly redis: RedisService,
    @InjectQueue(EMAIL_DLQ) private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<EmailProcessResult> {
    const data = job.data;

    if (data.type !== 'SEND_EMAIL' || data.version !== EMAIL_JOB_VERSION) {
      throw new UnrecoverableError(`Payload email không hợp lệ (version=${data.version})`);
    }
    if (!data.to || !data.template) {
      throw new UnrecoverableError('Email thiếu người nhận hoặc template');
    }

    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const rateKey = `mail:rate:${data.candidateId}:${hourBucket}`;
    const count = await this.redis.incrementWindow(rateKey, 3_600);

    if (count > EMAIL_RATE_LIMIT_PER_HOUR) {
      this.logger.warn(
        `Bỏ qua email ${data.template} cho candidate #${data.candidateId}: ` +
          `vượt ${EMAIL_RATE_LIMIT_PER_HOUR} email/giờ (lần ${count})`,
      );
      return { ok: true, skipped: true, reason: 'rate_limited' };
    }

    const rendered = renderEmail(data.template, data.data);
    await this.mailer.send({
      to: data.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return { ok: true };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EmailJobData> | undefined, error: Error): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;

    this.logger.warn(
      `Email job ${job.id} thất bại lần ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
    );

    if (!exhausted) return;

    try {
      await this.dlq.add(EMAIL_DLQ_JOB, {
        originalJobId: job.id,
        originalQueue: job.queueName,
        data: job.data,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      this.logger.error(`Email job ${job.id} đã chuyển sang DLQ "${EMAIL_DLQ}"`);
    } catch (dlqError) {
      this.logger.error(
        `Không ghi được email job ${job.id} vào DLQ: ${
          dlqError instanceof Error ? dlqError.message : String(dlqError)
        }`,
      );
    }
  }
}
