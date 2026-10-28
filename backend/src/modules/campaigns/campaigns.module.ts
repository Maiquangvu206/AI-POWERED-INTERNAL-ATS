import { Module } from '@nestjs/common';
import { AdminCampaignsController } from './admin-campaigns.controller';
import { AdminCriteriaController } from './admin-criteria.controller';
import { AdminRoundsController } from './admin-rounds.controller';
import { CampaignsService } from './campaigns.service';
import { CriteriaService } from './criteria.service';
import { PublicCampaignsController } from './public-campaigns.controller';
import { RoundsService } from './rounds.service';

@Module({
  controllers: [
    AdminCampaignsController,
    AdminRoundsController,
    AdminCriteriaController,
    PublicCampaignsController,
  ],
  providers: [CampaignsService, RoundsService, CriteriaService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
