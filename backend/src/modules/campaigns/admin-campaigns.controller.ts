import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, ListCampaignsQueryDto, UpdateCampaignDto } from './dto/campaign.dto';
import { ChangeCampaignStatusDto } from './dto/campaign-status.dto';

@ApiTags('admin/campaigns')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách chiến dịch (phân trang, lọc status/q)' })
  list(@Query() query: ListCampaignsQueryDto) {
    return this.campaigns.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo chiến dịch (slug tự sinh, mặc định DRAFT)' })
  create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.campaigns.create(dto, actorId, meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết chiến dịch kèm rounds + criteria + totalWeight' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật chiến dịch (không đổi slug; chặn khi CLOSED)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.campaigns.update(id, dto, actorId, meta);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Chuyển trạng thái DRAFT → OPEN → CLOSED (state machine)' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeCampaignStatusDto,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.campaigns.changeStatus(id, dto.status, actorId, meta);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá chiến dịch — chỉ khi DRAFT và chưa có hồ sơ' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.campaigns.remove(id, actorId, meta);
  }
}
