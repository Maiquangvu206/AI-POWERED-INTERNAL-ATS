import { Module } from '@nestjs/common';
import { AdminEvaluationsController, EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';

@Module({
  controllers: [EvaluationsController, AdminEvaluationsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}
