import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { SetFinalStatusDto } from './dto/final-status.dto';
import { CandidatesService } from './candidates.service';

@ApiTags('admin/candidates')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/candidates')
export class AdminCandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Patch(':id/final-status')
  @ApiOperation({ summary: 'Chốt kết quả cuối (PASSED/REJECTED) + gửi email cho ứng viên' })
  setFinalStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetFinalStatusDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.candidates.setFinalStatus(id, dto.finalStatus, actorId, meta);
  }

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Đẩy lại job phân tích AI cho hồ sơ (retry thủ công)' })
  reprocess(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.candidates.reprocess(id, actorId, meta);
  }
}

@ApiTags('admin/candidates')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminCandidateRankingController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get('campaigns/:campaignId/candidates')
  @ApiOperation({
    summary: 'Bảng xếp hạng theo ai_match_score + phân bố điểm (biểu đồ)',
  })
  ranking(@Param('campaignId', ParseIntPipe) campaignId: number) {
    return this.candidates.ranking(campaignId);
  }
}
