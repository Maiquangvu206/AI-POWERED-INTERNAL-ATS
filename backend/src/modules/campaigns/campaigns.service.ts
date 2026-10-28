import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, type Campaign } from '@prisma/client';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CampaignStatus as SharedCampaignStatus } from '@ats/shared';
import { CreateCampaignDto, ListCampaignsQueryDto, UpdateCampaignDto } from './dto/campaign.dto';
import {
  assertCampaignFound,
  isForeignKeyViolation,
  isUniqueViolation,
  parseDateOnly,
  slugify,
} from './campaigns.utils';

/** State machine: chỉ tiến, không nhảy cóc, không quay lại. */
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [CampaignStatus.OPEN],
  [CampaignStatus.OPEN]: [CampaignStatus.CLOSED],
  [CampaignStatus.CLOSED]: [],
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCampaignsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      ...(query.status ? { status: query.status as CampaignStatus } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { rounds: true, candidates: true } } },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async detail(id: number) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        rounds: {
          orderBy: { orderIndex: 'asc' },
          include: { criteria: { orderBy: { id: 'asc' } } },
        },
        _count: { select: { candidates: true } },
      },
    });

    if (!campaign) throw new NotFoundException(`Không tìm thấy chiến dịch #${id}`);

    return {
      ...campaign,
      rounds: campaign.rounds.map((round) => ({
        ...round,
        totalWeight: round.criteria.reduce((sum, item) => sum + Number(item.weight), 0),
        criteria: round.criteria.map((criterion) => ({
          ...criterion,
          maxScore: Number(criterion.maxScore),
          weight: Number(criterion.weight),
        })),
      })),
    };
  }

  async create(dto: CreateCampaignDto, actorId: number, meta?: ClientMeta) {
    this.assertDateRange(dto.startDate, dto.endDate);

    const base = slugify(dto.title);
    let created: Campaign | null = null;

    // Slug unique: thử base, rồi base-2, base-3… (xử lý cả trường hợp đua)
    for (let attempt = 1; attempt <= 20 && !created; attempt += 1) {
      const slug = attempt === 1 ? base : `${base}-${attempt}`;

      try {
        created = await this.prisma.campaign.create({
          data: {
            title: dto.title.trim(),
            slug,
            description: dto.description?.trim() || null,
            jdText: dto.jdText.trim(),
            startDate: parseDateOnly(dto.startDate, 'startDate'),
            endDate: parseDateOnly(dto.endDate, 'endDate'),
            createdBy: actorId,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    if (!created) {
      throw new ConflictException('Không sinh được slug duy nhất cho chiến dịch');
    }

    await this.audit.record({
      actorId,
      action: 'campaign.create',
      entityType: 'campaign',
      entityId: created.id,
      after: { title: created.title, slug: created.slug, status: created.status },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return created;
  }

  async update(id: number, dto: UpdateCampaignDto, actorId: number, meta?: ClientMeta) {
    const current = assertCampaignFound(
      await this.prisma.campaign.findUnique({ where: { id } }),
      id,
    );

    if (current.status === CampaignStatus.CLOSED) {
      throw new ConflictException('Chiến dịch đã đóng — không sửa được nữa');
    }

    const startValue = dto.startDate ?? current.startDate.toISOString().slice(0, 10);
    const endValue = dto.endDate ?? current.endDate.toISOString().slice(0, 10);
    this.assertDateRange(startValue, endValue);

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.jdText !== undefined ? { jdText: dto.jdText.trim() } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: parseDateOnly(dto.startDate, 'startDate') }
          : {}),
        ...(dto.endDate !== undefined ? { endDate: parseDateOnly(dto.endDate, 'endDate') } : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'campaign.update',
      entityType: 'campaign',
      entityId: id,
      before: {
        title: current.title,
        jdText: current.jdText,
        startDate: current.startDate,
        endDate: current.endDate,
      },
      after: {
        title: updated.title,
        jdText: updated.jdText,
        startDate: updated.startDate,
        endDate: updated.endDate,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return updated;
  }

  async changeStatus(id: number, target: SharedCampaignStatus, actorId: number, meta?: ClientMeta) {
    const current = assertCampaignFound(
      await this.prisma.campaign.findUnique({ where: { id } }),
      id,
    );

    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(target as CampaignStatus)) {
      throw new ConflictException(
        `Không thể chuyển trạng thái ${current.status} → ${target}. ` +
          `Chỉ cho phép: ${allowed.length ? allowed.join(', ') : '(không có, đã là trạng thái cuối)'}`,
      );
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: target as CampaignStatus },
    });

    await this.audit.record({
      actorId,
      action: 'campaign.status_change',
      entityType: 'campaign',
      entityId: id,
      before: { status: current.status },
      after: { status: updated.status },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return updated;
  }

  async remove(id: number, actorId: number, meta?: ClientMeta) {
    const current = assertCampaignFound(
      await this.prisma.campaign.findUnique({
        where: { id },
        include: { _count: { select: { candidates: true } } },
      }),
      id,
    );

    if (current.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Chỉ xoá được chiến dịch ở trạng thái DRAFT');
    }

    if (current._count.candidates > 0) {
      throw new ConflictException(
        `Chiến dịch đã có ${current._count.candidates} hồ sơ — không xoá được`,
      );
    }

    try {
      await this.prisma.campaign.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Chiến dịch đang được dữ liệu khác tham chiếu');
      }
      throw error;
    }

    await this.audit.record({
      actorId,
      action: 'campaign.delete',
      entityType: 'campaign',
      entityId: id,
      before: { title: current.title, slug: current.slug, status: current.status },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { id, deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Public (không lộ người tạo, không lộ hồ sơ)
  // ---------------------------------------------------------------------------

  async listPublic(status?: string) {
    const allowed: SharedCampaignStatus[] = ['OPEN', 'CLOSED'];
    const effective = (status ?? 'OPEN') as SharedCampaignStatus;

    if (!allowed.includes(effective)) {
      throw new BadRequestException(
        `status phải là một trong: ${allowed.join(', ')} (DRAFT không được tra cứu công khai)`,
      );
    }

    const items = await this.prisma.campaign.findMany({
      where: { status: effective as CampaignStatus },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    return items;
  }

  async getPublicBySlug(slug: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    if (!campaign || campaign.status === CampaignStatus.DRAFT) {
      throw new NotFoundException('Chiến dịch không tồn tại');
    }

    return campaign;
  }

  private assertDateRange(startValue: string, endValue: string): void {
    const start = parseDateOnly(startValue, 'startDate');
    const end = parseDateOnly(endValue, 'endDate');

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('endDate phải sau startDate');
    }
  }
}
