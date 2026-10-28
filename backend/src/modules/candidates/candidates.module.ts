import { Module } from '@nestjs/common';
import { AdminCandidatesController } from './admin-candidates.controller';
import { CandidatesService } from './candidates.service';
import { PublicApplicationsController } from './public-applications.controller';

@Module({
  controllers: [PublicApplicationsController, AdminCandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule {}
