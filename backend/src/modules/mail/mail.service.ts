import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EMAIL_JOB, EMAIL_JOB_VERSION, EMAIL_QUEUE } from '../../infra/queue/queue.constants';
import type { EmailTemplate } from './templates';

export interface EmailJobData {
  type: 'SEND_EMAIL';
  version: number;
  template: EmailTemplate;
  candidateId: number;
  to: string;
  data: Record<string, unknown>;
}

export interface ApplicationReceivedInput {
  candidateId: number;
  to: string;
  fullName: string;
  campaignTitle: string;
  trackingCode: string;
  submittedAt: Date;
}

export interface RoundResultInput {
  candidateId: number;
  to: string;
  fullName: string;
  campaignTitle: string;
  roundName: string;
  roundId: number;
  nextRoundName: string | null;
  trackingCode: string;
}

export interface FinalResultInput {
  candidateId: number;
  to: string;
  fullName: string;
  campaignTitle: string;
  status: 'PASSED' | 'REJECTED';
  trackingCode: string;
}

/**
 * Điểm vào duy nhất để đẩy email vào queue.
 *
 * Mọi phương thức đều trả về ngay sau khi `queue.add` — SMTP chỉ được gọi
 * trong worker, nhờ vậy request nộp hồ sơ/chuyển vòng không bị chậm.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly webOrigin: string;

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJobData>,
    config: ConfigService,
  ) {
    this.webOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:5173').replace(/\/$/, '');
  }

  async sendApplicationReceived(input: ApplicationReceivedInput): Promise<void> {
    await this.enqueue(
      {
        template: 'application-received',
        candidateId: input.candidateId,
        to: input.to,
        data: {
          fullName: input.fullName,
          campaignTitle: input.campaignTitle,
          trackingCode: input.trackingCode,
          trackingUrl: this.trackingUrl(input.trackingCode),
          submittedAt: input.submittedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        },
      },
      `application-received-${input.candidateId}`,
    );
  }

  async sendRoundResult(input: RoundResultInput): Promise<void> {
    await this.enqueue(
      {
        template: 'round-result',
        candidateId: input.candidateId,
        to: input.to,
        data: {
          fullName: input.fullName,
          campaignTitle: input.campaignTitle,
          roundName: input.roundName,
          nextRoundName: input.nextRoundName,
          trackingUrl: this.trackingUrl(input.trackingCode),
        },
      },
      `round-result-${input.candidateId}-${input.roundId}`,
    );
  }

  async sendFinalResult(input: FinalResultInput): Promise<void> {
    await this.enqueue(
      {
        template: 'final-result',
        candidateId: input.candidateId,
        to: input.to,
        data: {
          fullName: input.fullName,
          campaignTitle: input.campaignTitle,
          status: input.status,
          trackingUrl: this.trackingUrl(input.trackingCode),
        },
      },
      `final-result-${input.candidateId}-${input.status}`,
    );
  }

  /**
   * `jobId` cố định theo (template, ứng viên, vòng/kết quả) để BullMQ chống
   * gửi trùng khi Admin bấm lại cùng một thao tác.
   */
  private async enqueue(
    payload: Omit<EmailJobData, 'type' | 'version'>,
    jobId: string,
  ): Promise<void> {
    try {
      await this.queue.add(
        EMAIL_JOB,
        { type: 'SEND_EMAIL', version: EMAIL_JOB_VERSION, ...payload },
        { jobId },
      );
    } catch (error) {
      // Email không được làm hỏng giao dịch chính: hồ sơ đã lưu, audit đã ghi.
      this.logger.error(
        `Không enqueue được email ${payload.template} cho candidate #${payload.candidateId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private trackingUrl(trackingCode: string): string {
    return `${this.webOrigin}/track/${encodeURIComponent(trackingCode)}`;
  }
}
