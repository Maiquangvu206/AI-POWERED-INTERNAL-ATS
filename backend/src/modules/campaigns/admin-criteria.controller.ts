import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { CriteriaService } from './criteria.service';
import { CreateCriteriaDto, UpdateCriteriaDto } from './dto/criteria.dto';

@ApiTags('admin/criteria')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/campaigns/:campaignId/rounds/:roundId/criteria')
export class AdminCriteriaController {
  constructor(private readonly criteria: CriteriaService) {}

  @Post()
  @ApiOperation({ summary: 'Thêm tiêu chí (chặn nếu tổng weight vượt 1.000)' })
  create(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: CreateCriteriaDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.criteria.create(campaignId, roundId, dto, actorId, meta);
  }

  @Patch(':criteriaId')
  @ApiOperation({ summary: 'Sửa tiêu chí (chỉ khi vòng PENDING)' })
  update(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Param('criteriaId', ParseIntPipe) criteriaId: number,
    @Body() dto: UpdateCriteriaDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.criteria.update(campaignId, roundId, criteriaId, dto, actorId, meta);
  }

  @Delete(':criteriaId')
  @ApiOperation({ summary: 'Xoá tiêu chí — chặn nếu đã có phiếu điểm tham chiếu' })
  remove(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Param('criteriaId', ParseIntPipe) criteriaId: number,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.criteria.remove(campaignId, roundId, criteriaId, actorId, meta);
  }
}
