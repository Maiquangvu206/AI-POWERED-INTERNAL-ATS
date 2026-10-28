import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { RoundsService } from './rounds.service';
import { ChangeRoundStatusDto, CreateRoundDto, UpdateRoundDto } from './dto/round.dto';

@ApiTags('admin/rounds')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/campaigns/:campaignId/rounds')
export class AdminRoundsController {
  constructor(private readonly rounds: RoundsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách vòng của chiến dịch (kèm criteria + totalWeight)' })
  list(@Param('campaignId', ParseIntPipe) campaignId: number) {
    return this.rounds.list(campaignId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo vòng — orderIndex tự tăng nếu bỏ trống' })
  create(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: CreateRoundDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.rounds.create(campaignId, dto, actorId, meta);
  }

  @Get(':roundId')
  @ApiOperation({ summary: 'Chi tiết một vòng' })
  detail(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
  ) {
    return this.rounds.detail(campaignId, roundId);
  }

  @Patch(':roundId')
  @ApiOperation({ summary: 'Sửa tên/thứ tự vòng (chỉ khi PENDING)' })
  update(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: UpdateRoundDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.rounds.update(campaignId, roundId, dto, actorId, meta);
  }

  @Patch(':roundId/status')
  @ApiOperation({
    summary: 'PENDING → IN_PROGRESS (kiểm SUM(weight)=1) → LOCKED (khoá điểm)',
  })
  changeStatus(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: ChangeRoundStatusDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.rounds.changeStatus(campaignId, roundId, dto, actorId, meta);
  }

  @Delete(':roundId')
  @ApiOperation({ summary: 'Xoá vòng — chỉ khi PENDING và chưa gán ứng viên' })
  remove(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.rounds.remove(campaignId, roundId, actorId, meta);
  }
}
