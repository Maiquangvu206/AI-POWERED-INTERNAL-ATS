import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, RoundStatus } from '@prisma/client';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { CreateEvaluationDto, EvaluationScoreDto, UpdateEvaluationDto } from './dto/evaluation.dto';

/** Ngưỡng cảnh báo lệch điểm giữa các giám khảo (thang 0–100). */
const OUTLIER_GAP = 3;

type RoundWithCriteria = Prisma.RoundGetPayload<{ include: { criteria: true } }>;

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  /** Ứng viên đang ở vòng — kèm phiếu của chính giám khảo đang đăng nhập. */
  async listRoundCandidates(roundId: number, userId: number) {
    const round = await this.getRoundOrFail(roundId);

    const candidates = await this.prisma.candidate.findMany({
      where: {
        campaignId: round.campaignId,
        OR: [{ currentRoundId: roundId }, { currentRoundId: null }],
      },
      orderBy: [{ aiMatchScore: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        trackingCode: true,
        aiMatchScore: true,
        aiParsedSkills: true,
        currentRoundId: true,
        finalStatus: true,
        createdAt: true,
        evaluations: {
          where: { roundId, interviewerId: userId },
          select: {
            id: true,
            totalScore: true,
            submittedAt: true,
            generalNotes: true,
            details: { select: { criterionId: true, score: true, comment: true } },
          },
        },
      },
    });

    return {
      round: this.serializeRound(round),
      candidates: candidates.map(({ evaluations, ...candidate }) => ({
        ...candidate,
        aiMatchScore: candidate.aiMatchScore === null ? null : Number(candidate.aiMatchScore),
        myEvaluation: evaluations[0]
          ? {
              ...evaluations[0],
              totalScore: Number(evaluations[0].totalScore),
              details: evaluations[0].details.map((detail) => ({
                ...detail,
                score: Number(detail.score),
              })),
            }
          : null,
      })),
    };
  }

  /**
   * Nộp phiếu điểm (US-05).
   *
   * Toàn bộ cha + con nằm trong một transaction (ADR-03); vòng phải IN_PROGRESS
   * và điểm phải phủ đủ rubric trước khi ghi.
   */
  async create(dto: CreateEvaluationDto, interviewerId: number, meta?: ClientMeta) {
    const round = await this.getRoundOrFail(dto.roundId);
    this.assertOpenForScoring(round);

    await this.assertCandidateInRound(dto.candidateId, round.campaignId);
    const details = this.validateScores(round, dto.scores);
    const totalScore = this.weightedTotal(round, details);

    try {
      const evaluation = await this.prisma.$transaction(async (tx) => {
        const created = await tx.evaluation.create({
          data: {
            roundId: round.id,
            candidateId: dto.candidateId,
            interviewerId,
            totalScore: new Prisma.Decimal(totalScore.toFixed(2)),
            generalNotes: dto.generalNotes?.trim() || null,
            details: {
              create: details.map((detail) => ({
                criterionId: detail.criterionId,
                score: new Prisma.Decimal(detail.score.toFixed(2)),
                comment: detail.comment?.trim() || null,
              })),
            },
          },
          include: this.evaluationInclude(),
        });

        await tx.candidate.update({
          where: { id: dto.candidateId },
          data: { currentRoundId: round.id },
        });

        return created;
      });

      await this.audit.record({
        actorId: interviewerId,
        action: 'evaluation.create',
        entityType: 'evaluation',
        entityId: evaluation.id,
        after: {
          roundId: round.id,
          candidateId: dto.candidateId,
          totalScore,
        },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return this.serializeEvaluation(evaluation);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Bạn đã nộp phiếu cho ứng viên này ở vòng này. Dùng PATCH để cập nhật.',
        );
      }
      throw error;
    }
  }

  /** Sửa phiếu của chính mình khi vòng còn IN_PROGRESS (trước khi unblind). */
  async update(evaluationId: number, dto: UpdateEvaluationDto, userId: number, meta?: ClientMeta) {
    const current = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { round: { include: { criteria: true } } },
    });

    if (!current) throw new NotFoundException(`Không tìm thấy phiếu #${evaluationId}`);
    if (current.interviewerId !== userId) {
      throw new ForbiddenException('Bạn chỉ được sửa phiếu của chính mình');
    }
    this.assertOpenForScoring(current.round);

    const details = dto.scores ? this.validateScores(current.round, dto.scores) : null;
    const totalScore = details ? this.weightedTotal(current.round, details) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (details) {
        await tx.evaluationDetail.deleteMany({ where: { evaluationId } });
      }

      return tx.evaluation.update({
        where: { id: evaluationId },
        data: {
          ...(dto.generalNotes !== undefined
            ? { generalNotes: dto.generalNotes.trim() || null }
            : {}),
          ...(details
            ? {
                totalScore: new Prisma.Decimal(totalScore!.toFixed(2)),
                details: {
                  create: details.map((detail) => ({
                    criterionId: detail.criterionId,
                    score: new Prisma.Decimal(detail.score.toFixed(2)),
                    comment: detail.comment?.trim() || null,
                  })),
                },
              }
            : {}),
        },
        include: this.evaluationInclude(),
      });
    });

    await this.audit.record({
      actorId: userId,
      action: 'evaluation.update',
      entityType: 'evaluation',
      entityId: evaluationId,
      before: { totalScore: Number(current.totalScore) },
      after: { totalScore: Number(updated.totalScore) },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.serializeEvaluation(updated);
  }

  /**
   * Bảng điểm của vòng (ADR-02).
   *
   * - Interviewer + vòng IN_PROGRESS: chỉ trả phiếu của chính mình (blind ở tầng SQL),
   *   không lộ danh tính giám khảo khác.
   * - Admin hoặc vòng LOCKED: unblind toàn bộ + cảnh báo outlier khi lệch > 3 điểm.
   */
  async getScores(roundId: number, userId: number, role: Role) {
    const round = await this.getRoundOrFail(roundId);
    const blind = role !== Role.ADMIN && round.status !== RoundStatus.LOCKED;

    const evaluations = await this.prisma.evaluation.findMany({
      where: { roundId, ...(blind ? { interviewerId: userId } : {}) },
      orderBy: [{ candidateId: 'asc' }, { totalScore: 'desc' }],
      include: this.evaluationInclude(),
    });

    const summary = this.summarize(
      evaluations.map((evaluation) => ({
        candidateId: evaluation.candidateId,
        interviewerId: evaluation.interviewerId,
        totalScore: Number(evaluation.totalScore),
      })),
    );

    return {
      round: this.serializeRound(round),
      blind,
      evaluations: evaluations.map((evaluation) => this.serializeEvaluation(evaluation, blind)),
      summary,
    };
  }

  /** Gán ứng viên vào vòng (Admin) — chỉ khi vòng IN_PROGRESS. */
  async assignCandidate(candidateId: number, roundId: number, actorId: number, meta?: ClientMeta) {
    const round = await this.getRoundOrFail(roundId);
    if (round.status !== RoundStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Vòng đang ở trạng thái ${round.status} — chỉ nhận ứng viên khi IN_PROGRESS`,
      );
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        campaignId: true,
        currentRoundId: true,
        currentRound: { select: { roundName: true } },
        fullName: true,
        email: true,
        trackingCode: true,
        campaign: { select: { title: true } },
      },
    });

    if (!candidate || candidate.campaignId !== round.campaignId) {
      throw new NotFoundException(
        `Không tìm thấy ứng viên #${candidateId} trong chiến dịch của vòng này`,
      );
    }

    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { currentRoundId: roundId },
      select: { id: true, currentRoundId: true },
    });

    await this.audit.record({
      actorId,
      action: 'candidate.assign_round',
      entityType: 'candidate',
      entityId: candidateId,
      before: {
        currentRoundId: candidate.currentRoundId,
        roundName: candidate.currentRound?.roundName ?? null,
      },
      after: { currentRoundId: updated.currentRoundId, roundName: round.roundName },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    // Chỉ gửi khi thực sự chuyển từ vòng cũ sang vòng mới (không gửi lúc gán lần đầu).
    if (candidate.currentRoundId && candidate.currentRoundId !== roundId) {
      await this.mail.sendRoundResult({
        candidateId: candidate.id,
        to: candidate.email,
        fullName: candidate.fullName,
        campaignTitle: candidate.campaign.title,
        roundName: candidate.currentRound?.roundName ?? `#${candidate.currentRoundId}`,
        roundId: candidate.currentRoundId,
        nextRoundName: round.roundName,
        trackingCode: candidate.trackingCode,
      });
    }

    return updated;
  }

  /** Khoá vòng & unblind (Admin) — chỉ từ IN_PROGRESS. */
  async lockRound(roundId: number, actorId: number, meta?: ClientMeta) {
    const round = await this.getRoundOrFail(roundId);
    if (round.status !== RoundStatus.IN_PROGRESS) {
      throw new ConflictException(`Chỉ khoá được vòng IN_PROGRESS (hiện tại ${round.status})`);
    }

    const updated = await this.prisma.round.update({
      where: { id: roundId },
      data: { status: RoundStatus.LOCKED, lockedAt: new Date(), lockedBy: actorId },
      include: { criteria: { orderBy: { id: 'asc' } } },
    });

    await this.audit.record({
      actorId,
      action: 'round.lock',
      entityType: 'round',
      entityId: roundId,
      before: { status: round.status },
      after: { status: updated.status, lockedAt: updated.lockedAt },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.serializeRound(updated);
  }

  /**
   * Chấm điểm có trọng số, chuẩn hoá về thang 100:
   *   Σ (score / maxScore × weight) × 100
   */
  private weightedTotal(round: RoundWithCriteria, details: EvaluationScoreDto[]): number {
    const byId = new Map(details.map((detail) => [detail.criterionId, detail]));
    const total = round.criteria.reduce((sum, criterion) => {
      const detail = byId.get(criterion.id)!;
      return sum + (detail.score / Number(criterion.maxScore)) * Number(criterion.weight);
    }, 0);
    return Math.max(0, Math.min(100, total * 100));
  }

  private validateScores(round: RoundWithCriteria, scores: EvaluationScoreDto[]) {
    if (round.criteria.length === 0) {
      throw new ConflictException('Vòng chưa có rubric — không thể chấm điểm');
    }

    const expected = new Map(round.criteria.map((criterion) => [criterion.id, criterion]));
    const seen = new Set<number>();

    for (const score of scores) {
      const criterion = expected.get(score.criterionId);
      if (!criterion) {
        throw new BadRequestException(
          `Tiêu chí #${score.criterionId} không thuộc rubric của vòng này`,
        );
      }
      if (seen.has(score.criterionId)) {
        throw new BadRequestException(`Tiêu chí #${score.criterionId} bị chấm trùng`);
      }
      seen.add(score.criterionId);

      if (score.score > Number(criterion.maxScore)) {
        throw new BadRequestException(
          `Điểm của "${criterion.title}" vượt mức tối đa ${Number(criterion.maxScore)}`,
        );
      }
    }

    const missing = [...expected.values()].filter((criterion) => !seen.has(criterion.id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Chưa chấm các tiêu chí: ${missing.map((criterion) => criterion.title).join(', ')}`,
      );
    }

    return scores;
  }

  private assertOpenForScoring(round: { status: RoundStatus; campaignId: number }): void {
    if (round.status !== RoundStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Vòng đang ở trạng thái ${round.status} — chỉ chấm điểm khi IN_PROGRESS`,
      );
    }
  }

  private async assertCandidateInRound(candidateId: number, campaignId: number): Promise<void> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { campaignId: true, currentRoundId: true },
    });

    if (!candidate || candidate.campaignId !== campaignId) {
      throw new NotFoundException(`Không tìm thấy ứng viên #${candidateId} trong chiến dịch này`);
    }
  }

  private async getRoundOrFail(roundId: number): Promise<RoundWithCriteria> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: { criteria: { orderBy: { id: 'asc' } } },
    });

    if (!round) throw new NotFoundException(`Không tìm thấy vòng #${roundId}`);
    return round;
  }

  private summarize(
    rows: Array<{ candidateId: number; interviewerId: number; totalScore: number }>,
  ) {
    const byCandidate = new Map<number, number[]>();
    for (const row of rows) {
      const list = byCandidate.get(row.candidateId) ?? [];
      list.push(row.totalScore);
      byCandidate.set(row.candidateId, list);
    }

    return [...byCandidate.entries()].map(([candidateId, scores]) => {
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      return {
        candidateId,
        count: scores.length,
        average: round2(scores.reduce((sum, score) => sum + score, 0) / scores.length),
        min: round2(min),
        max: round2(max),
        /** Cảnh báo hội đồng khi giám khảo lệch nhau quá ngưỡng (Phase 4). */
        outlier: scores.length > 1 && max - min > OUTLIER_GAP,
      };
    });
  }

  private evaluationInclude() {
    return {
      details: { include: { criterion: true } },
      interviewer: { select: { id: true, fullName: true, email: true } },
      candidate: { select: { id: true, fullName: true, trackingCode: true } },
    } satisfies Prisma.EvaluationInclude;
  }

  private serializeEvaluation(
    evaluation: Prisma.EvaluationGetPayload<{
      include: {
        details: { include: { criterion: true } };
        interviewer: { select: { id: true; fullName: true; email: true } };
        candidate: { select: { id: true; fullName: true; trackingCode: true } };
      };
    }>,
    blind = false,
  ) {
    return {
      ...evaluation,
      // Blind: không lộ danh tính giám khảo khác cho Interviewer
      ...(blind ? { interviewer: undefined } : {}),
      totalScore: Number(evaluation.totalScore),
      details: evaluation.details.map((detail) => ({
        ...detail,
        score: Number(detail.score),
        criterion: {
          ...detail.criterion,
          maxScore: Number(detail.criterion.maxScore),
          weight: Number(detail.criterion.weight),
        },
      })),
    };
  }

  private serializeRound(round: RoundWithCriteria) {
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
