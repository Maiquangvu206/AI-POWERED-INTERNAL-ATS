import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AssignCandidateRoundDto,
  CreateEvaluationDto,
  UpdateEvaluationDto,
} from './dto/evaluation.dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('evaluations')
@ApiBearerAuth()
@Roles(Role.INTERVIEWER, Role.ADMIN)
@Controller()
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get('rounds/:roundId/candidates')
  @ApiOperation({ summary: 'Ứng viên trong vòng + phiếu của chính tôi (blind)' })
  listCandidates(
    @Param('roundId', ParseIntPipe) roundId: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.evaluations.listRoundCandidates(roundId, userId);
  }

  @Post('evaluations')
  @ApiOperation({ summary: 'Nộp phiếu điểm (transaction ACID, 1 phiếu/giám khảo/vòng)' })
  create(
    @Body() dto: CreateEvaluationDto,
    @CurrentUser('userId') userId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.evaluations.create(dto, userId, meta);
  }

  @Patch('evaluations/:id')
  @ApiOperation({ summary: 'Sửa phiếu của chính mình khi vòng còn IN_PROGRESS' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEvaluationDto,
    @CurrentUser('userId') userId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.evaluations.update(id, dto, userId, meta);
  }

  @Get('rounds/:roundId/scores')
  @ApiOperation({
    summary: 'Bảng điểm — Interviewer bị blind khi chưa LOCKED; Admin thấy toàn bộ',
  })
  scores(
    @Param('roundId', ParseIntPipe) roundId: number,
    @CurrentUser('userId') userId: number,
    @CurrentUser('role') role: Role,
  ) {
    return this.evaluations.getScores(roundId, userId, role);
  }
}

@ApiTags('admin/evaluations')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminEvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Patch('candidates/:candidateId/round')
  @ApiOperation({ summary: 'Gán ứng viên vào vòng IN_PROGRESS + audit log' })
  assign(
    @Param('candidateId', ParseIntPipe) candidateId: number,
    @Body() dto: AssignCandidateRoundDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.evaluations.assignCandidate(candidateId, dto.roundId, actorId, meta);
  }

  @Post('rounds/:roundId/lock')
  @ApiOperation({ summary: 'Khoá vòng & unblind (chỉ từ IN_PROGRESS) + audit log' })
  lock(
    @Param('roundId', ParseIntPipe) roundId: number,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.evaluations.lockRound(roundId, actorId, meta);
  }
}
