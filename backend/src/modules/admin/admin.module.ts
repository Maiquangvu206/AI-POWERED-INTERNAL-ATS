import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueueProbeController } from './queue-probe.controller';
import { StorageProbeController } from './storage-probe.controller';

@Module({
  controllers: [AdminController, StorageProbeController, QueueProbeController],
})
export class AdminModule {}
