import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudSyncJob } from '@/database/entities';
import { HttpMetricsService } from '@/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([CloudSyncJob])],
  controllers: [MetricsController],
  providers: [HttpMetricsService, MetricsService],
  exports: [HttpMetricsService],
})
export class MetricsModule {}
