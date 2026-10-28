import { Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CV_PROCESSING_DLQ,
  CV_PROCESSING_JOB,
  CV_PROCESSING_QUEUE,
} from '../../infra/queue/queue.constants';

/**
 * Endpoint chẩn đoán queue — chỉ ADMIN.
 * Chứng minh: enqueue → worker xử lý → retry → DLQ.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/queue-probe')
export class QueueProbeController {
  constructor(
    @InjectQueue(CV_PROCESSING_QUEUE) private readonly queue: Queue,
    @InjectQueue(CV_PROCESSING_DLQ) private readonly dlq: Queue,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Đẩy một job thử vào queue cv-processing' })
  async enqueue(): Promise<{ jobId: string; queue: string; attempts: number }> {
    const job = await this.queue.add(CV_PROCESSING_JOB, { probe: true });

    return {
      jobId: String(job.id),
      queue: CV_PROCESSING_QUEUE,
      attempts: job.opts.attempts ?? 1,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Tổng quan số job theo trạng thái + nội dung DLQ' })
  async overview(): Promise<{
    queue: string;
    counts: Record<string, number>;
    deadLetterQueue: string;
    deadLetterCounts: Record<string, number>;
    deadJobs: Array<{ id: string; failedReason: string; data: unknown }>;
  }> {
    const [counts, deadLetterCounts, deadJobs] = await Promise.all([
      this.queue.getJobCounts('wait', 'active', 'delayed', 'completed', 'failed'),
      this.dlq.getJobCounts('wait', 'active', 'completed', 'failed'),
      this.dlq.getJobs(['wait', 'failed', 'completed'], 0, 20, false),
    ]);

    return {
      queue: CV_PROCESSING_QUEUE,
      counts,
      deadLetterQueue: CV_PROCESSING_DLQ,
      deadLetterCounts,
      deadJobs: deadJobs.map((job) => ({
        id: String(job.id),
        failedReason: String((job.data as { failedReason?: string }).failedReason ?? ''),
        data: job.data,
      })),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Trạng thái chi tiết của một job' })
  async status(@Param('id') id: string): Promise<{
    id: string;
    name: string;
    state: string;
    attemptsMade: number;
    attempts: number;
    failedReason: string | null;
    returnvalue: unknown;
    processedOn: string | null;
    finishedOn: string | null;
  }> {
    const job = await this.queue.getJob(id);

    if (!job) {
      throw new NotFoundException(`Không tìm thấy job "${id}" trong queue ${CV_PROCESSING_QUEUE}`);
    }

    return {
      id: String(job.id),
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      attempts: job.opts.attempts ?? 1,
      failedReason: job.failedReason ?? null,
      returnvalue: job.returnvalue ?? null,
      processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };
  }
}
