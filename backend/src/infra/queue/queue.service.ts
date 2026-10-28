import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import {
  CV_PROCESSING_JOB,
  CV_PROCESSING_JOB_VERSION,
  CV_PROCESSING_QUEUE,
  type CvProcessingJobType,
} from './queue.constants';

export interface CvProcessingJobData {
  type: CvProcessingJobType;
  version: number;
  /** Có khi job đến từ luồng nộp hồ sơ thật. */
  candidateId?: number;
  /** Khoá object trong bucket `cv-files`. */
  objectKey?: string;
  /** Job do `/admin/queue-probe` tạo — không đụng dữ liệu ứng viên. */
  probe?: boolean;
  /** Số lần đã đẩy lại thủ công (reprocess). */
  reattempt?: number;
}

/**
 * Điểm vào DUY NHẤT để đẩy job vào queue.
 * Controller/module khác không tự gọi `queue.add` để tránh lệch payload.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue(CV_PROCESSING_QUEUE) private readonly queue: Queue) {}

  async enqueueCvProcessing(
    data: Omit<CvProcessingJobData, 'type' | 'version'>,
  ): Promise<Job<CvProcessingJobData>> {
    const payload: CvProcessingJobData = {
      type: 'CV_PROCESSING',
      version: CV_PROCESSING_JOB_VERSION,
      ...data,
    };

    // Job id duy nhất cho mỗi lần đẩy: cho phép reprocess cùng một candidate
    // nhiều lần mà không bị BullMQ coi là job trùng.
    const jobId = data.candidateId ? `cv-${data.candidateId}-${Date.now()}` : undefined;

    const job = await this.queue.add(CV_PROCESSING_JOB, payload, { jobId });

    this.logger.log(
      `Đã đẩy job ${job.id} (candidate=${data.candidateId ?? 'probe'}) vào ${CV_PROCESSING_QUEUE}`,
    );

    return job;
  }

  async getJob(id: string): Promise<Job<CvProcessingJobData> | undefined> {
    return this.queue.getJob(id);
  }

  async getCounts(): Promise<Record<string, number>> {
    return this.queue.getJobCounts('wait', 'active', 'delayed', 'completed', 'failed');
  }
}
