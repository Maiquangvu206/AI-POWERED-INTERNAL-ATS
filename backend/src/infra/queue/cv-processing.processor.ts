import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, UnrecoverableError, type Job } from 'bullmq';
import { CV_PROCESSING_DLQ, CV_PROCESSING_QUEUE, DLQ_JOB } from './queue.constants';
import type { CvProcessingJobData } from './queue.service';

/** Phải ngắn hơn backoff để không treo worker khi AI Service chết hẳn. */
const AI_PING_TIMEOUT_MS = 5_000;

export interface CvProcessingResult {
  ok: true;
  aiStatus: number;
  aiService: string | null;
  checkedAt: string;
}

/**
 * Consumer của queue `cv-processing` (ADR-0005).
 *
 * Phase 2 chỉ ping AI Service để chứng minh đường ống BullMQ hoạt động:
 * Redis → producer → worker → retry → DLQ. Phase 3 sẽ thay phần thân bằng
 * lời gọi thật tới `/parse-cv` và ghi kết quả vào `candidates`.
 */
@Processor(CV_PROCESSING_QUEUE)
export class CvProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(CvProcessingProcessor.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(CV_PROCESSING_DLQ) private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<CvProcessingJobData>): Promise<CvProcessingResult> {
    const { type, version } = job.data;

    // Payload lạ: retry không giải quyết được gì → fail ngay, vào DLQ để điều tra
    if (type !== 'CV_PROCESSING' || typeof version !== 'number') {
      throw new UnrecoverableError(`Payload job không hợp lệ: type=${type} version=${version}`);
    }

    const aiUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:8010');
    const attempt = job.attemptsMade + 1;

    this.logger.log(
      `Job ${job.id} (v${version}) — lần thử ${attempt}/${job.opts.attempts ?? 1}` +
        ` | candidate=${job.data.candidateId ?? '-'} | GET ${aiUrl}/health`,
    );

    const headers: Record<string, string> = { Accept: 'application/json' };
    const internalToken = this.config.get<string>('AI_INTERNAL_TOKEN');
    if (internalToken) headers['X-Internal-Token'] = internalToken;

    let response: Response;
    try {
      response = await fetch(`${aiUrl}/health`, {
        headers,
        signal: AbortSignal.timeout(AI_PING_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Không gọi được AI Service (${aiUrl}): ${reason}`);
    }

    if (!response.ok) {
      throw new Error(`AI Service /health trả HTTP ${response.status}`);
    }

    const body = (await response.json().catch(() => null)) as { service?: string } | null;

    return {
      ok: true,
      aiStatus: response.status,
      aiService: body?.service ?? null,
      checkedAt: new Date().toISOString(),
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CvProcessingJobData>): void {
    this.logger.log(`Job ${job.id} hoàn tất`);
  }

  /**
   * BullMQ không có DLQ sẵn: khi job đã dùng hết `attempts`, ta chép nó sang
   * queue `cv-processing-dlq` để người vận hành còn thấy nguyên nhân.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<CvProcessingJobData> | undefined, error: Error): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;

    this.logger.warn(
      `Job ${job.id} thất bại lần ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
    );

    if (!exhausted) return;

    try {
      await this.dlq.add(DLQ_JOB, {
        originalJobId: job.id,
        originalQueue: job.queueName,
        data: job.data,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
      this.logger.error(`Job ${job.id} đã chuyển sang DLQ "${CV_PROCESSING_DLQ}"`);
    } catch (dlqError) {
      // Không ném tiếp: nếu ném, BullMQ coi lần xử lý sự kiện này là lỗi
      this.logger.error(
        `Không ghi được job ${job.id} vào DLQ: ${
          dlqError instanceof Error ? dlqError.message : String(dlqError)
        }`,
      );
    }
  }
}
