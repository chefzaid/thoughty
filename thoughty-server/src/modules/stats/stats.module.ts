import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsJournalAnalysisService } from './stats-journal-analysis.service';
import { StatsPersonalityAnalysisService } from './stats-personality-analysis.service';
import { StatsCorrelationService } from './stats-correlation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry]), AiModule],
  controllers: [StatsController],
  providers: [
    StatsService,
    StatsJournalAnalysisService,
    StatsPersonalityAnalysisService,
    StatsCorrelationService,
  ],
  exports: [StatsService],
})
export class StatsModule {}
