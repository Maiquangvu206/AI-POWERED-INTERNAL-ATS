import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CampaignsService } from './campaigns.service';

@ApiTags('public/campaigns')
@Controller('public/campaigns')
export class PublicCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Danh sách chiến dịch công khai (mặc định chỉ OPEN)' })
  list(@Query('status') status?: string) {
    return this.campaigns.listPublic(status);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết chiến dịch công khai theo slug' })
  detail(@Param('slug') slug: string) {
    return this.campaigns.getPublicBySlug(slug);
  }
}
