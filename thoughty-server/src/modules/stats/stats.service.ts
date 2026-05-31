import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { StatsResponseDto } from './dto';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
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

    // Total entries count
    const totalThoughts = await createQb().getCount();

    // Entries per year
    const perYearResult = await createQb()
      .select('EXTRACT(YEAR FROM e.date)', 'year')
      .addSelect('COUNT(*)', 'count')
      .groupBy('EXTRACT(YEAR FROM e.date)')
      .orderBy('year', 'DESC')
      .getRawMany();

    const thoughtsPerYear: Record<string, number> = {};
    for (const row of perYearResult) {
      thoughtsPerYear[row.year] = Number.parseInt(row.count, 10);
    }

    // Entries per month
    const perMonthResult = await createQb()
      .select("TO_CHAR(e.date, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(e.date, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .getRawMany();

    const thoughtsPerMonth: Record<string, number> = {};
    for (const row of perMonthResult) {
      thoughtsPerMonth[row.month] = Number.parseInt(row.count, 10);
    }

    // Entries per day
    const perDayResult = await createQb()
      .select("TO_CHAR(e.date, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(e.date, 'YYYY-MM-DD')")
      .orderBy('day', 'DESC')
      .getRawMany();

    const thoughtsPerDay: Record<string, number> = {};
    for (const row of perDayResult) {
      thoughtsPerDay[row.day] = Number.parseInt(row.count, 10);
    }

    // Entries per tag
    const perTagResult = await createQb()
      .select('UNNEST(e.tags)', 'tag')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tag')
      .orderBy('count', 'DESC')
      .getRawMany();

    const thoughtsPerTag: Record<string, number> = {};
    for (const row of perTagResult) {
      thoughtsPerTag[row.tag] = Number.parseInt(row.count, 10);
    }

    // Tags per year
    const tagsPerYearResult = await createQb()
      .select('EXTRACT(YEAR FROM e.date)', 'year')
      .addSelect('UNNEST(e.tags)', 'tag')
      .addSelect('COUNT(*)', 'count')
      .groupBy('EXTRACT(YEAR FROM e.date)')
      .addGroupBy('tag')
      .orderBy('year', 'DESC')
      .addOrderBy('count', 'DESC')
      .getRawMany();

    const tagsPerYear: Record<string, Record<string, number>> = {};
    for (const row of tagsPerYearResult) {
      const year = row.year;
      if (!tagsPerYear[year]) {
        tagsPerYear[year] = {};
      }
      tagsPerYear[year][row.tag] = Number.parseInt(row.count, 10);
    }

    // Tags per month
    const tagsPerMonthResult = await createQb()
      .select("TO_CHAR(e.date, 'YYYY-MM')", 'month')
      .addSelect('UNNEST(e.tags)', 'tag')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(e.date, 'YYYY-MM')")
      .addGroupBy('tag')
      .orderBy('month', 'DESC')
      .addOrderBy('count', 'DESC')
      .getRawMany();

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

    return {
      totalThoughts,
      uniqueTagsCount,
      thoughtsPerYear,
      thoughtsPerMonth,
      thoughtsPerDay,
      thoughtsPerTag,
      tagsPerYear,
      tagsPerMonth,
    };
  }
}
