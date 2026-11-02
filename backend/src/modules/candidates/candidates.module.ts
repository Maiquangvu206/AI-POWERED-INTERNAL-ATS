import { Module } from '@nestjs/common';
import {
  AdminCandidateRankingController,
  AdminCandidatesController,
} from './admin-candidates.controller';
import { CandidatesService } from './candidates.service';
import { PublicApplicationsController } from './public-applications.controller';

@Module({
  controllers: [
    PublicApplicationsController,
    AdminCandidatesController,
    AdminCandidateRankingController,
  ],
  providers: [CandidatesService],
})
export class CandidatesModule {}
