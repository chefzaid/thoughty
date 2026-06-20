import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudSyncJob } from '@/database/entities';
import { FeatureTelemetryService, HttpMetricsService } from '@/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([CloudSyncJob])],
  controllers: [MetricsController],
  providers: [FeatureTelemetryService, HttpMetricsService, MetricsService],
  exports: [FeatureTelemetryService, HttpMetricsService],
})
export class MetricsModule {}
