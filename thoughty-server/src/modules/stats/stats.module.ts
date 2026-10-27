import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, Entry } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsJournalAnalysisService } from './stats-journal-analysis.service';
import { StatsPersonalityAnalysisService } from './stats-personality-analysis.service';
import { StatsCorrelationService } from './stats-correlation.service';
import { StatsMoodService } from './stats-mood.service';
import { StatsGoalService } from './stats-goal.service';
import { StatsStreakService } from './stats-streak.service';

@Module({
  imports: [TypeOrmModule.forFeature([Diary, Entry]), AiModule],
  controllers: [StatsController],
  providers: [
    StatsService,
    StatsJournalAnalysisService,
    StatsPersonalityAnalysisService,
    StatsCorrelationService,
    StatsMoodService,
    StatsGoalService,
    StatsStreakService,
  ],
  exports: [StatsService],
})
export class StatsModule {}
