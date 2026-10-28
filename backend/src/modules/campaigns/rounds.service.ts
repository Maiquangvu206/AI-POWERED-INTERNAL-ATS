import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, RoundStatus } from '@prisma/client';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RoundStatus as SharedRoundStatus } from '@ats/shared';
import { ChangeRoundStatusDto, CreateRoundDto, UpdateRoundDto } from './dto/round.dto';
import { WEIGHT_TOLERANCE, isUniqueViolation, sumWeights } from './campaigns.utils';

/** Vòng thi cũng chỉ tiến: PENDING → IN_PROGRESS → LOCKED. */
const ALLOWED_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  [RoundStatus.PENDING]: [RoundStatus.IN_PROGRESS],
  [RoundStatus.IN_PROGRESS]: [RoundStatus.LOCKED],
  [RoundStatus.LOCKED]: [],
};

@Injectable()
export class RoundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(campaignId: number) {
    await this.assertCampaign(campaignId);

    const rounds = await this.prisma.round.findMany({
      where: { campaignId },
      orderBy: { orderIndex: 'asc' },
      include: { criteria: { orderBy: { id: 'asc' } } },
    });

    return rounds.map((round) => this.serialize(round));
  }

  async detail(campaignId: number, roundId: number) {
    const round = await this.getRoundOrFail(campaignId, roundId);
    return this.serialize(round);
  }

  async create(campaignId: number, dto: CreateRoundDto, actorId: number, meta?: ClientMeta) {
    const campaign = await this.assertCampaign(campaignId);
    if (campaign.status === CampaignStatus.CLOSED) {
      throw new ConflictException('Chiến dịch đã đóng — không thêm vòng mới');
    }

    const orderIndex =
      dto.orderIndex ??
      ((
        await this.prisma.round.aggregate({
          where: { campaignId },
          _max: { orderIndex: true },
        })
      )._max.orderIndex ?? 0) + 1;

    try {
      const round = await this.prisma.round.create({
        data: { campaignId, roundName: dto.roundName.trim(), orderIndex },
        include: { criteria: true },
      });

      await this.audit.record({
        actorId,
        action: 'round.create',
        entityType: 'round',
        entityId: round.id,
        after: { campaignId, roundName: round.roundName, orderIndex: round.orderIndex },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return this.serialize(round);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Campaign đã có vòng với order_index = ${orderIndex}. Chọn số khác.`,
        );
      }
      throw error;
    }
  }

  async update(
    campaignId: number,
    roundId: number,
    dto: UpdateRoundDto,
    actorId: number,
    meta?: ClientMeta,
  ) {
    const round = await this.getRoundOrFail(campaignId, roundId);
    this.assertEditable(round, 'sửa');

    try {
      const updated = await this.prisma.round.update({
        where: { id: roundId },
        data: {
          ...(dto.roundName !== undefined ? { roundName: dto.roundName.trim() } : {}),
          ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
        },
        include: { criteria: { orderBy: { id: 'asc' } } },
      });

      await this.audit.record({
        actorId,
        action: 'round.update',
        entityType: 'round',
        entityId: roundId,
        before: { roundName: round.roundName, orderIndex: round.orderIndex },
        after: { roundName: updated.roundName, orderIndex: updated.orderIndex },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return this.serialize(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('order_index đã tồn tại trong campaign này');
      }
      throw error;
    }
  }

  /**
   * Chuyển trạng thái vòng.
   *
   * PENDING → IN_PROGRESS: chỉ khi rubric đã đủ và `SUM(weight) = 1.000 ± 0.001`.
   * IN_PROGRESS → LOCKED: khoá điểm, ghi `locked_at` / `locked_by` (ADR-0002).
   */
  async changeStatus(
    campaignId: number,
    roundId: number,
    dto: ChangeRoundStatusDto,
    actorId: number,
    meta?: ClientMeta,
  ) {
    const round = await this.getRoundOrFail(campaignId, roundId);
    const target = dto.status as SharedRoundStatus;

    const allowed = ALLOWED_TRANSITIONS[round.status];
    if (!allowed.includes(target as RoundStatus)) {
      throw new ConflictException(
        `Không thể chuyển vòng ${round.status} → ${target}. ` +
          `Chỉ cho phép: ${allowed.length ? allowed.join(', ') : '(không có, đã LOCKED)'}`,
      );
    }

    if (target === 'IN_PROGRESS') {
      this.assertWeightsValid(round);
    }

    const updated = await this.prisma.round.update({
      where: { id: roundId },
      data: {
        status: target as RoundStatus,
        ...(target === 'LOCKED' ? { lockedAt: new Date(), lockedBy: actorId } : {}),
      },
      include: { criteria: { orderBy: { id: 'asc' } } },
    });

    await this.audit.record({
      actorId,
      action: target === 'LOCKED' ? 'round.lock' : 'round.status_change',
      entityType: 'round',
      entityId: roundId,
      before: { status: round.status },
      after: { status: updated.status, lockedAt: updated.lockedAt },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.serialize(updated);
  }

  async remove(campaignId: number, roundId: number, actorId: number, meta?: ClientMeta) {
    const round = await this.getRoundOrFail(campaignId, roundId);
    this.assertEditable(round, 'xoá');

    const assigned = await this.prisma.candidate.count({ where: { currentRoundId: roundId } });
    if (assigned > 0) {
      throw new ConflictException(
        `Vòng đang có ${assigned} ứng viên — không thể xoá. Chuyển ứng viên sang vòng khác trước.`,
      );
    }

    await this.prisma.round.delete({ where: { id: roundId } });

    await this.audit.record({
      actorId,
      action: 'round.delete',
      entityType: 'round',
      entityId: roundId,
      before: { campaignId, roundName: round.roundName, orderIndex: round.orderIndex },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { id: roundId, deleted: true };
  }

  /** Kiểm tra rubric: có ít nhất 1 tiêu chí và tổng weight = 1.000 ± 0.001. */
  private assertWeightsValid(round: { id: number; criteria: Array<{ weight: unknown }> }): void {
    if (round.criteria.length === 0) {
      throw new ConflictException('Vòng chưa có tiêu chí nào — không thể bắt đầu chấm điểm');
    }

    const total = sumWeights(round.criteria);
    if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
      throw new ConflictException(
        `Tổng weight của rubric phải bằng 1.000 (±${WEIGHT_TOLERANCE}), hiện tại là ${total.toFixed(3)}`,
      );
    }
  }

  private assertEditable(
    round: { status: RoundStatus; campaign: { status: CampaignStatus } },
    action: string,
  ): void {
    if (round.campaign.status === CampaignStatus.CLOSED) {
      throw new ConflictException('Chiến dịch đã đóng — không sửa được vòng thi');
    }
    if (round.status !== RoundStatus.PENDING) {
      throw new ConflictException(
        `Vòng đang ở trạng thái ${round.status} — không ${action} được nữa (rubric đã bị khoá)`,
      );
    }
  }

  private async assertCampaign(campaignId: number) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true },
    });

    if (!campaign) throw new NotFoundException(`Không tìm thấy chiến dịch #${campaignId}`);
    return campaign;
  }

  private async getRoundOrFail(campaignId: number, roundId: number) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        criteria: { orderBy: { id: 'asc' } },
        campaign: { select: { id: true, status: true } },
      },
    });

    if (!round || round.campaignId !== campaignId) {
      throw new NotFoundException(
        `Không tìm thấy vòng #${roundId} trong chiến dịch #${campaignId}`,
      );
    }

    return round;
  }

  private serialize(round: {
    id: number;
    campaignId: number;
    roundName: string;
    orderIndex: number;
    status: RoundStatus;
    lockedAt: Date | null;
    lockedBy: number | null;
    createdAt: Date;
    updatedAt: Date;
    criteria: Array<{
      id: number;
      roundId: number;
      title: string;
      maxScore: unknown;
      weight: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }) {
    const criteria = round.criteria.map((criterion) => ({
      ...criterion,
      maxScore: Number(criterion.maxScore),
      weight: Number(criterion.weight),
    }));

    return {
      ...round,
      criteria,
      totalWeight: criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    };
  }
}
