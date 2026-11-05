import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, FinalStatus } from '@prisma/client';
import { ApplyFormSchema, Role } from '@ats/shared';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CaptchaService } from '../../infra/captcha/captcha.service';
import { QueueService } from '../../infra/queue/queue.service';
import { StorageService } from '../../infra/storage/storage.service';
import { inspectCvFile } from '../../infra/storage/cv-file.validation';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { isUniqueViolation } from '../campaigns/campaigns.utils';

/** Bỏ các ký tự dễ nhầm (I, O, 0, 1) để ứng viên đọc/ghi mã không sai. */
const TRACKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Bắt đầu một ngày theo UTC — cột `start_date` / `end_date` là kiểu DATE. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
    private readonly captcha: CaptchaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Ứng viên nộp hồ sơ công khai (US-03).
   *
   * Thứ tự cố ý: validate → upload storage → tạo DB → enqueue.
   * Nếu tạo DB thất bại thì xoá object vừa upload (không để file mồ côi).
   */
  async apply(
    slug: string,
    body: Record<string, unknown>,
    file: Express.Multer.File | undefined,
    meta?: ClientMeta,
    actor?: AuthenticatedUser,
  ) {
    if (actor && (actor.role === Role.ADMIN || actor.role === Role.INTERVIEWER)) {
      throw new ForbiddenException(
        'Tài khoản nội bộ không thể nộp hồ sơ ứng viên. Vui lòng đăng xuất hoặc dùng cửa sổ ẩn danh.',
      );
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!campaign || campaign.status !== CampaignStatus.OPEN) {
      throw new NotFoundException('Chiến dịch không tồn tại hoặc chưa mở nhận hồ sơ');
    }

    const today = startOfUtcDay(new Date());
    if (today < campaign.startDate || today > campaign.endDate) {
      throw new ConflictException('Chiến dịch đang ngoài thời gian nhận hồ sơ');
    }

    await this.captcha.verify((body as { turnstileToken?: unknown }).turnstileToken, meta?.ip);

    const parsed = ApplyFormSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: parsed.error.issues.map((issue) => issue.message).join('; '),
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      });
    }

    if (!file) {
      throw new BadRequestException('Thiếu file CV — gửi multipart với field tên "cv"');
    }

    // Không tin Content-Type: đọc 4 byte đầu, đồng thời kiểm giới hạn 5 MB
    const inspected = inspectCvFile(file.buffer);

    const objectKey = this.storage.buildCvKey();
    await this.storage.putObject(objectKey, file.buffer);

    let candidate: { id: number; trackingCode: string; createdAt: Date };
    try {
      candidate = await this.createWithUniqueTrackingCode({
        campaignId: campaign.id,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        cvFileUrl: objectKey,
        cvFileHash: inspected.sha256,
      });
    } catch (error) {
      // Bù trừ: DB không có record thì file cũng không được nằm lại
      await this.storage.deleteObject(objectKey);
      throw error;
    }

    try {
      await this.queue.enqueueCvProcessing({
        candidateId: candidate.id,
        objectKey,
      });
    } catch (error) {
      // Không làm hỏng hồ sơ đã nhận: Phase 3 sẽ có job quét lại + endpoint reprocess
      this.logger.error(
        `Không enqueue được job cho candidate #${candidate.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.audit.record({
      actorId: null,
      action: 'candidate.apply',
      entityType: 'candidate',
      entityId: candidate.id,
      after: {
        campaignId: campaign.id,
        trackingCode: candidate.trackingCode,
        objectKey,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    // Không chờ SMTP: MailService chỉ đẩy job, worker gửi sau.
    await this.mail.sendApplicationReceived({
      candidateId: candidate.id,
      to: parsed.data.email,
      fullName: parsed.data.fullName,
      campaignTitle: campaign.title,
      trackingCode: candidate.trackingCode,
      submittedAt: candidate.createdAt,
    });

    return {
      trackingCode: candidate.trackingCode,
      submittedAt: candidate.createdAt.toISOString(),
      campaign: { title: campaign.title, slug: campaign.slug },
    };
  }

  /** Tra cứu công khai: chỉ trả dữ liệu đã che, tuyệt đối không trả điểm/liên hệ. */
  async track(code: string) {
    const trackingCode = code.trim().toUpperCase();

    const candidate = await this.prisma.candidate.findUnique({
      where: { trackingCode },
      select: {
        trackingCode: true,
        fullName: true,
        finalStatus: true,
        createdAt: true,
        campaign: { select: { title: true, slug: true } },
        currentRound: { select: { roundName: true, orderIndex: true, status: true } },
      },
    });

    if (!candidate) {
      throw new NotFoundException('Không tìm thấy hồ sơ với mã tra cứu này');
    }

    return {
      trackingCode: candidate.trackingCode,
      fullName: maskFullName(candidate.fullName),
      status: candidate.finalStatus,
      campaign: candidate.campaign,
      currentRound: candidate.currentRound,
      submittedAt: candidate.createdAt.toISOString(),
    };
  }

  /**
   * Bảng xếp hạng ứng viên theo `ai_match_score` + phân bố điểm cho biểu đồ.
   * Ứng viên chưa chấm AI (`ai_match_score = NULL`) xếp cuối.
   */
  async ranking(campaignId: number) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true, status: true },
    });
    if (!campaign) throw new NotFoundException(`Không tìm thấy chiến dịch #${campaignId}`);

    const candidates = await this.prisma.candidate.findMany({
      where: { campaignId },
      orderBy: [{ aiMatchScore: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      select: {
        id: true,
        fullName: true,
        email: true,
        trackingCode: true,
        aiMatchScore: true,
        aiParsedSkills: true,
        aiError: true,
        aiProcessedAt: true,
        finalStatus: true,
        createdAt: true,
        currentRound: { select: { id: true, roundName: true, status: true } },
      },
    });

    const items = candidates.map((candidate) => ({
      ...candidate,
      aiMatchScore: candidate.aiMatchScore === null ? null : Number(candidate.aiMatchScore),
    }));

    // Biểu đồ phân bố: 5 khoảng 20 điểm, tính cả hồ sơ chưa chấm AI
    const buckets = Array.from({ length: 5 }, (_, index) => ({
      from: index * 20,
      to: index * 20 + 20,
      count: 0,
    }));
    let pending = 0;
    for (const item of items) {
      if (item.aiMatchScore === null) {
        pending += 1;
        continue;
      }
      const index = Math.min(Math.floor(item.aiMatchScore / 20), 4);
      buckets[index].count += 1;
    }

    return {
      campaign,
      items,
      distribution: buckets,
      stats: {
        total: items.length,
        pending,
        processed: items.length - pending,
        average:
          items.filter((item) => item.aiMatchScore !== null).length > 0
            ? Math.round(
                (items.reduce((sum, item) => sum + (item.aiMatchScore ?? 0), 0) /
                  (items.length - pending)) *
                  100,
              ) / 100
            : null,
      },
    };
  }

  /** ADMIN đẩy lại job AI cho một hồ sơ (khi AI Service từng chết / cần chấm lại). */
  async reprocess(candidateId: number, actorId: number, meta?: ClientMeta) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true, cvFileUrl: true, campaignId: true },
    });

    if (!candidate) {
      throw new NotFoundException(`Không tìm thấy hồ sơ #${candidateId}`);
    }

    if (!candidate.cvFileUrl) {
      throw new ConflictException('Hồ sơ không có file CV — không thể chạy lại AI');
    }

    const job = await this.queue.enqueueCvProcessing({
      candidateId: candidate.id,
      objectKey: candidate.cvFileUrl,
      reattempt: 1,
    });

    await this.audit.record({
      actorId,
      action: 'candidate.reprocess',
      entityType: 'candidate',
      entityId: candidate.id,
      after: { jobId: String(job.id), objectKey: candidate.cvFileUrl },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      candidateId: candidate.id,
      jobId: String(job.id),
      queue: 'cv-processing',
    };
  }

  /**
   * Admin chốt kết quả cuối (PASSED/REJECTED) và gửi email cho ứng viên.
   * Đặt lại PENDING chỉ để sửa sai — không gửi email.
   */
  async setFinalStatus(
    candidateId: number,
    status: FinalStatus,
    actorId: number,
    meta?: ClientMeta,
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        finalStatus: true,
        fullName: true,
        email: true,
        trackingCode: true,
        campaign: { select: { title: true } },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Không tìm thấy hồ sơ #${candidateId}`);
    }

    if (candidate.finalStatus === status) {
      return { candidateId, finalStatus: status, changed: false, emailQueued: false };
    }

    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { finalStatus: status },
    });

    await this.audit.record({
      actorId,
      action: 'candidate.final_status',
      entityType: 'candidate',
      entityId: candidateId,
      before: { finalStatus: candidate.finalStatus },
      after: { finalStatus: status },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const emailQueued = status !== FinalStatus.PENDING;
    if (emailQueued) {
      await this.mail.sendFinalResult({
        candidateId: candidate.id,
        to: candidate.email,
        fullName: candidate.fullName,
        campaignTitle: candidate.campaign.title,
        status,
        trackingCode: candidate.trackingCode,
      });
    }

    return { candidateId, finalStatus: status, changed: true, emailQueued };
  }

  /**
   * `tracking_code` là UNIQUE toàn hệ thống → sinh ngẫu nhiên rồi retry.
   * Checklist yêu cầu 3 lần thử; va chạm 3 lần liên tiếp gần như không thể
   * xảy ra (32^4 = 1.048.576 tổ hợp mỗi năm), nhưng vẫn xử lý tường minh.
   */
  private async createWithUniqueTrackingCode(data: {
    campaignId: number;
    fullName: string;
    email: string;
    phone: string;
    cvFileUrl: string;
    cvFileHash: string;
  }): Promise<{ id: number; trackingCode: string; createdAt: Date }> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.candidate.create({
          data: {
            ...data,
            trackingCode: generateTrackingCode(),
          },
          select: { id: true, trackingCode: true, createdAt: true },
        });
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 3) {
          if (isUniqueViolation(error)) {
            throw new ConflictException('Không sinh được mã tra cứu duy nhất, vui lòng thử lại');
          }
          throw error;
        }
      }
    }

    // Không thể tới đây (vòng lặp luôn return hoặc throw), giữ để TypeScript yên tâm
    throw new ConflictException('Không sinh được mã tra cứu duy nhất, vui lòng thử lại');
  }
}

/** `APP-YYYY-XXXX` — năm lấy theo UTC. */
export function generateTrackingCode(year = new Date().getUTCFullYear()): string {
  let suffix = '';
  for (let index = 0; index < 4; index += 1) {
    suffix += TRACKING_ALPHABET[randomInt(TRACKING_ALPHABET.length)];
  }
  return `APP-${year}-${suffix}`;
}

/**
 * Che tên: giữ chữ cái đầu mỗi từ, thay phần còn lại bằng `*`.
 * Ứng viên tự nhận ra hồ sơ của mình, người khác thì không.
 */
export function maskFullName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word[0]}${'*'.repeat(Math.max(word.length - 1, 1))}`)
    .join(' ');
}
