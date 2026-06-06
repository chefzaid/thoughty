import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { StatsResponseDto } from './dto';
import { StatsToneAnalysisService } from './stats-tone-analysis.service';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly statsToneAnalysisService: StatsToneAnalysisService,
  ) {}

  async getStats(userId: number, diaryId?: number): Promise<StatsResponseDto> {
    // Build base query builder
    const createQb = () => {
      const qb = this.entryRepository
        .createQueryBuilder('e')
        .where('e.user_id = :userId', { userId });

      if (diaryId) {
        qb.andWhere('e.diary_id = :diaryId', { diaryId });
      }

      return qb;
    };

    const [
      totalThoughts,
      perYearResult,
      perMonthResult,
      perDayResult,
      perTagResult,
      tagsPerYearResult,
      tagsPerMonthResult,
    ] = await Promise.all([
      createQb().getCount(),
      createQb()
        .select('EXTRACT(YEAR FROM e.date)', 'year')
        .addSelect('COUNT(*)', 'count')
        .groupBy('EXTRACT(YEAR FROM e.date)')
        .orderBy('year', 'DESC')
        .getRawMany(),
      createQb()
        .select("TO_CHAR(e.date, 'YYYY-MM')", 'month')
        .addSelect('COUNT(*)', 'count')
        .groupBy("TO_CHAR(e.date, 'YYYY-MM')")
        .orderBy('month', 'DESC')
        .getRawMany(),
      createQb()
        .select("TO_CHAR(e.date, 'YYYY-MM-DD')", 'day')
        .addSelect('COUNT(*)', 'count')
        .groupBy("TO_CHAR(e.date, 'YYYY-MM-DD')")
        .orderBy('day', 'DESC')
        .getRawMany(),
      createQb()
        .select('UNNEST(e.tags)', 'tag')
        .addSelect('COUNT(*)', 'count')
        .groupBy('tag')
        .orderBy('count', 'DESC')
        .getRawMany(),
      createQb()
        .select('EXTRACT(YEAR FROM e.date)', 'year')
        .addSelect('UNNEST(e.tags)', 'tag')
        .addSelect('COUNT(*)', 'count')
        .groupBy('EXTRACT(YEAR FROM e.date)')
        .addGroupBy('tag')
        .orderBy('year', 'DESC')
        .addOrderBy('count', 'DESC')
        .getRawMany(),
      createQb()
        .select("TO_CHAR(e.date, 'YYYY-MM')", 'month')
        .addSelect('UNNEST(e.tags)', 'tag')
        .addSelect('COUNT(*)', 'count')
        .groupBy("TO_CHAR(e.date, 'YYYY-MM')")
        .addGroupBy('tag')
        .orderBy('month', 'DESC')
        .addOrderBy('count', 'DESC')
        .getRawMany(),
    ]);

    const thoughtsPerYear: Record<string, number> = {};
    for (const row of perYearResult) {
      thoughtsPerYear[row.year] = Number.parseInt(row.count, 10);
    }

    const thoughtsPerMonth: Record<string, number> = {};
    for (const row of perMonthResult) {
      thoughtsPerMonth[row.month] = Number.parseInt(row.count, 10);
    }

    const thoughtsPerDay: Record<string, number> = {};
    for (const row of perDayResult) {
      thoughtsPerDay[row.day] = Number.parseInt(row.count, 10);
    }

    const thoughtsPerTag: Record<string, number> = {};
    for (const row of perTagResult) {
      thoughtsPerTag[row.tag] = Number.parseInt(row.count, 10);
    }

    const tagsPerYear: Record<string, Record<string, number>> = {};
    for (const row of tagsPerYearResult) {
      const year = row.year;
      if (!tagsPerYear[year]) {
        tagsPerYear[year] = {};
      }
      tagsPerYear[year][row.tag] = Number.parseInt(row.count, 10);
    }

    const tagsPerMonth: Record<string, Record<string, number>> = {};
    for (const row of tagsPerMonthResult) {
      const month = row.month;
      if (!tagsPerMonth[month]) {
        tagsPerMonth[month] = {};
      }
      tagsPerMonth[month][row.tag] = Number.parseInt(row.count, 10);
    }

    // Unique tags count - use subquery to avoid aggregate function with set-returning function
    const uniqueTagsCount = Object.keys(thoughtsPerTag).length;
    const recentEntries = totalThoughts > 0
      ? await createQb()
        .select(['e.id', 'e.content', 'e.date', 'e.tags'])
        .orderBy('e.date', 'DESC')
        .addOrderBy('e.id', 'DESC')
        .take(40)
        .getMany()
      : [];
    const toneMoodAnalysis = await this.statsToneAnalysisService.analyze(userId, recentEntries);

    return {
      totalThoughts,
      uniqueTagsCount,
      thoughtsPerYear,
      thoughtsPerMonth,
      thoughtsPerDay,
      thoughtsPerTag,
      tagsPerYear,
      tagsPerMonth,
      toneMoodAnalysis,
    };
  }
}
