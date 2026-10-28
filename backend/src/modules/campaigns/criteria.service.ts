import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, RoundStatus } from '@prisma/client';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCriteriaDto, UpdateCriteriaDto } from './dto/criteria.dto';
import { isForeignKeyViolation, isUniqueViolation, sumWeights } from './campaigns.utils';

@Injectable()
export class CriteriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    campaignId: number,
    roundId: number,
    dto: CreateCriteriaDto,
    actorId: number,
    meta?: ClientMeta,
  ) {
    const round = await this.getRoundOrFail(campaignId, roundId);
    this.assertEditable(round, 'thêm tiêu chí');

    const projected = sumWeights(round.criteria) + dto.weight;
    if (projected > 1 + 0.001) {
      throw new ConflictException(
        `Tổng weight sau khi thêm sẽ là ${projected.toFixed(3)} (> 1.000). ` +
          'Giảm weight của tiêu chí khác trước.',
      );
    }

    try {
      const criterion = await this.prisma.criteria.create({
        data: {
          roundId,
          title: dto.title.trim(),
          maxScore: dto.maxScore,
          weight: dto.weight,
        },
      });

      await this.audit.record({
        actorId,
        action: 'criteria.create',
        entityType: 'criteria',
        entityId: criterion.id,
        after: {
          roundId,
          title: criterion.title,
          maxScore: Number(criterion.maxScore),
          weight: Number(criterion.weight),
        },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return this.serialize(criterion);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Vòng đã có tiêu chí tên "${dto.title.trim()}"`);
      }
      throw error;
    }
  }

  async update(
    campaignId: number,
    roundId: number,
    criteriaId: number,
    dto: UpdateCriteriaDto,
    actorId: number,
    meta?: ClientMeta,
  ) {
    const round = await this.getRoundOrFail(campaignId, roundId);
    this.assertEditable(round, 'sửa tiêu chí');

    const current = round.criteria.find((item) => item.id === criteriaId);
    if (!current) {
      throw new NotFoundException(`Không tìm thấy tiêu chí #${criteriaId} trong vòng #${roundId}`);
    }

    try {
      const updated = await this.prisma.criteria.update({
        where: { id: criteriaId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}),
          ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        },
      });

      await this.audit.record({
        actorId,
        action: 'criteria.update',
        entityType: 'criteria',
        entityId: criteriaId,
        before: {
          title: current.title,
          maxScore: Number(current.maxScore),
          weight: Number(current.weight),
        },
        after: {
          title: updated.title,
          maxScore: Number(updated.maxScore),
          weight: Number(updated.weight),
        },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return this.serialize(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Tên tiêu chí đã tồn tại trong vòng này');
      }
      throw error;
    }
  }

  async remove(
    campaignId: number,
    roundId: number,
    criteriaId: number,
    actorId: number,
    meta?: ClientMeta,
  ) {
    const round = await this.getRoundOrFail(campaignId, roundId);
    this.assertEditable(round, 'xoá tiêu chí');

    const current = round.criteria.find((item) => item.id === criteriaId);
    if (!current) {
      throw new NotFoundException(`Không tìm thấy tiêu chí #${criteriaId} trong vòng #${roundId}`);
    }

    try {
      await this.prisma.criteria.delete({ where: { id: criteriaId } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Tiêu chí đã có phiếu điểm tham chiếu — không thể xoá (chỉ có thể sửa)',
        );
      }
      throw error;
    }

    await this.audit.record({
      actorId,
      action: 'criteria.delete',
      entityType: 'criteria',
      entityId: criteriaId,
      before: {
        roundId,
        title: current.title,
        maxScore: Number(current.maxScore),
        weight: Number(current.weight),
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { id: criteriaId, deleted: true };
  }

  /**
   * Rubric chỉ được sửa khi vòng còn `PENDING`.
   * Khi đã `IN_PROGRESS` hoặc `LOCKED`, sửa weight sẽ làm sai mọi điểm đã chấm.
   */
  private assertEditable(
    round: {
      status: RoundStatus;
      campaign: { status: CampaignStatus };
    },
    action: string,
  ): void {
    if (round.campaign.status === CampaignStatus.CLOSED) {
      throw new ConflictException('Chiến dịch đã đóng — không sửa được rubric');
    }

    if (round.status !== RoundStatus.PENDING) {
      throw new ConflictException(
        `Vòng đang ở trạng thái ${round.status} — không ${action} được. ` +
          'Rubric chỉ sửa được khi vòng còn PENDING.',
      );
    }
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

  private serialize(criterion: {
    id: number;
    roundId: number;
    title: string;
    maxScore: unknown;
    weight: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...criterion,
      maxScore: Number(criterion.maxScore),
      weight: Number(criterion.weight),
    };
  }
}
