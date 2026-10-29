import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue, UnrecoverableError, type Job } from 'bullmq';
import { CV_PROCESSING_DLQ, CV_PROCESSING_QUEUE, DLQ_JOB } from './queue.constants';
import type { CvProcessingJobData } from './queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Ping health ngắn — không được treo worker khi AI Service chết hẳn. */
const AI_PING_TIMEOUT_MS = 5_000;
/** Analyze có thể gồm OCR nên cho dài hơn nhiều so với ping. */
const DEFAULT_ANALYZE_TIMEOUT_MS = 120_000;

interface AiAnalyzeResponse {
  score: number;
  profile: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    skills?: string[];
    totalYearsExperience?: number | null;
    roles?: string[];
    educationLevel?: string | null;
    languages?: string[];
    summary?: string | null;
    /** AI Service dùng snake_case — chấp nhận cả hai để không vỡ khi đổi version. */
    total_years_experience?: number | null;
    education_level?: string | null;
  };
  breakdown: Record<string, unknown>;
  extraction: Record<string, unknown>;
  llm_used?: boolean;
  ai_version?: string;
}

export interface CvProcessingResult {
  ok: true;
  aiStatus: number;
  aiService: string | null;
  checkedAt: string;
  candidateId?: number;
  score?: number;
  llmUsed?: boolean;
  semanticMethod?: string;
  elapsedMs?: number;
}

/**
 * Consumer của queue `cv-processing` (ADR-0005).
 *
 * - Job probe: chỉ ping `/health` (giữ nguyên cách kiểm chứng Phase 1).
 * - Job thật: lấy signed URL → gọi AI Service `/internal/v1/ai/analyze`
 *   → ghi `ai_match_score`, `ai_parsed_skills`, `ai_match_breakdown`.
 *
 * Lỗi AI **không** xoá hồ sơ: chỉ ghi `ai_error` rồi ném để BullMQ retry/DLQ.
 */
@Processor(CV_PROCESSING_QUEUE)
export class CvProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(CvProcessingProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(CV_PROCESSING_DLQ) private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<CvProcessingJobData>): Promise<CvProcessingResult> {
    const { type, version } = job.data;

    if (type !== 'CV_PROCESSING' || typeof version !== 'number') {
      throw new UnrecoverableError(`Payload job không hợp lệ: type=${type} version=${version}`);
    }

    if (job.data.probe) {
      return this.pingAi(job);
    }

    return this.analyzeCandidate(job);
  }

  /** Job chẩn đoán: chỉ kiểm tra AI Service sống. */
  private async pingAi(job: Job<CvProcessingJobData>): Promise<CvProcessingResult> {
    const aiUrl = this.aiBaseUrl();
    const headers = this.aiHeaders();

    const response = await this.fetchWithError(
      `${aiUrl}/health`,
      { method: 'GET', headers, signal: AbortSignal.timeout(AI_PING_TIMEOUT_MS) },
      aiUrl,
    );

    const body = (await response.json().catch(() => null)) as {
      service?: string;
      model_loaded?: boolean;
    } | null;

    this.logger.log(
      `Job probe ${job.id}: AI ${body?.service ?? '?'} (model_loaded=${body?.model_loaded})`,
    );

    return {
      ok: true,
      aiStatus: response.status,
      aiService: body?.service ?? null,
      checkedAt: new Date().toISOString(),
    };
  }

  /** Job thật: bóc tách CV + chấm điểm và lưu kết quả. */
  private async analyzeCandidate(job: Job<CvProcessingJobData>): Promise<CvProcessingResult> {
    const candidateId = job.data.candidateId;
    const objectKey = job.data.objectKey;

    if (!candidateId || !objectKey) {
      throw new UnrecoverableError('Job thiếu candidateId hoặc objectKey');
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        cvFileUrl: true,
        campaign: { select: { id: true, jdText: true, title: true } },
      },
    });

    if (!candidate) {
      throw new UnrecoverableError(`Không tìm thấy candidate #${candidateId}`);
    }

    const aiUrl = this.aiBaseUrl();
    const timeoutMs = this.config.get<number>('AI_ANALYZE_TIMEOUT_MS', DEFAULT_ANALYZE_TIMEOUT_MS);
    const started = Date.now();

    try {
      const signedUrl = await this.storage.getSignedDownloadUrl(candidate.cvFileUrl, 600);

      const response = await this.fetchWithError(
        `${aiUrl}/internal/v1/ai/analyze`,
        {
          method: 'POST',
          headers: { ...this.aiHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cv_url: signedUrl,
            jd_text: candidate.campaign.jdText,
            required_skills: [],
            candidate_id: candidate.id,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
        aiUrl,
      );

      const body = (await response.json()) as AiAnalyzeResponse;
      this.assertValidResult(body);

      const profile = body.profile;
      const parsedSkills = {
        skills: profile.skills ?? [],
        totalYearsExperience:
          profile.totalYearsExperience ?? profile.total_years_experience ?? null,
        roles: profile.roles ?? [],
        educationLevel: profile.educationLevel ?? profile.education_level ?? null,
        languages: profile.languages ?? [],
        summary: profile.summary ?? null,
      };

      await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          aiMatchScore: new Prisma.Decimal(body.score.toFixed(2)),
          aiParsedSkills: parsedSkills as Prisma.InputJsonValue,
          aiMatchBreakdown: body.breakdown as Prisma.InputJsonValue,
          aiProcessedAt: new Date(),
          aiError: null,
        },
      });

      const elapsedMs = Date.now() - started;
      this.logger.log(
        `Job ${job.id} — candidate #${candidate.id} chấm xong: ${body.score}/100 ` +
          `(llm=${body.llm_used ? 'yes' : 'heuristic'}, ${elapsedMs}ms)`,
      );

      return {
        ok: true,
        aiStatus: response.status,
        aiService: 'ai-service',
        checkedAt: new Date().toISOString(),
        candidateId: candidate.id,
        score: body.score,
        llmUsed: body.llm_used ?? false,
        semanticMethod: String(
          (body.breakdown as { semantic_method?: string }).semantic_method ?? 'unknown',
        ),
        elapsedMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Lưu nguyên nhân để Admin thấy trên UI; không xoá điểm cũ (nếu có)
      await this.prisma.candidate
        .update({
          where: { id: candidate.id },
          data: { aiError: message.slice(0, 2000) },
        })
        .catch(() => undefined);

      this.logger.error(`Job ${job.id} — candidate #${candidate.id} lỗi AI: ${message}`);
      throw error;
    }
  }

  private aiBaseUrl(): string {
    return this.config.get<string>('AI_SERVICE_URL', 'http://localhost:8010').replace(/\/$/, '');
  }

  private aiHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const internalToken = this.config.get<string>('AI_INTERNAL_TOKEN');
    if (internalToken) headers['X-Internal-Token'] = internalToken;
    return headers;
  }

  private async fetchWithError(url: string, init: RequestInit, aiUrl: string): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Không gọi được AI Service (${aiUrl}): ${reason}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `AI Service ${url} trả HTTP ${response.status}` +
          (detail ? `: ${detail.slice(0, 500)}` : ''),
      );
    }

    return response;
  }

  private assertValidResult(body: AiAnalyzeResponse): void {
    if (typeof body.score !== 'number' || body.score < 0 || body.score > 100) {
      throw new Error('AI Service trả score không hợp lệ');
    }
    if (!body.profile || typeof body.profile !== 'object') {
      throw new Error('AI Service thiếu profile');
    }
    if (!body.breakdown || typeof body.breakdown !== 'object') {
      throw new Error('AI Service thiếu breakdown');
    }
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
