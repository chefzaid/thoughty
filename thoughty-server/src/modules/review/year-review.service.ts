import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Attachment, Diary, Entry, YearReviewMood } from '@/database/entities';
import { addSameDayOrder } from '@/common/utils';
import { AiCredentialsService } from '@/modules/ai';
import type {
  YearReviewComparisonDto,
  YearReviewDto,
  YearReviewHighlightDto,
  YearReviewMoodDto,
  YearReviewRecordedMoodDto,
  YearReviewTagDto,
} from './dto';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import { countWords, isoWeekdayIndex, longestStreak } from './year-review-stats';

const TOP_TAGS = 10;
const NEW_TAGS = 10;
const FAVORITE_HIGHLIGHTS = 4;
const EXCERPT_LENGTH = 220;
const TOP_FEELINGS = 5;

export interface YearEntry {
  id: number;
  date: string;
  index: number;
  content: string;
  tags: string[];
  isFavorite: boolean;
  isArchived: boolean;
  mood: number | null;
  feelings: string[];
  words: number;
}

export function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function toMoodDto(mood: YearReviewMood): YearReviewMoodDto {
  return {
    months: mood.months,
    summary: mood.summary,
    analyzedEntries: mood.analyzedEntries,
    generatedAt: mood.createdAt.toISOString(),
  };
}

const roundMood = (value: number): number => Math.round(value * 10) / 10;

/**
 * The year's mood arc from the moods the writer recorded, without AI: the average of each month
 * with a recorded mood and the feeling words used most. Null when no entry of the year has a mood.
 */
export function summarizeRecordedMoods(entries: Array<Pick<YearEntry, 'date' | 'mood' | 'feelings'>>): YearReviewRecordedMoodDto | null {
  const months = new Map<string, { total: number; entries: number }>();
  const feelings = new Map<string, number>();
  let total = 0;
  let recorded = 0;
  for (const entry of entries) {
    for (const feeling of new Set(entry.feelings)) {
      feelings.set(feeling, (feelings.get(feeling) ?? 0) + 1);
    }
    if (entry.mood === null) {
      continue;
    }
    const month = entry.date.slice(0, 7);
    const sum = months.get(month) ?? { total: 0, entries: 0 };
    months.set(month, { total: sum.total + entry.mood, entries: sum.entries + 1 });
    total += entry.mood;
    recorded++;
  }
  if (recorded === 0) {
    return null;
  }
  return {
    entries: recorded,
    average: roundMood(total / recorded),
    months: [...months.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([month, sum]) => ({ month, average: roundMood(sum.total / sum.entries), entries: sum.entries })),
    topFeelings: [...feelings.entries()]
      .map(([feeling, count]) => ({ feeling, count }))
      .sort((first, second) => second.count - first.count || first.feeling.localeCompare(second.feeling))
      .slice(0, TOP_FEELINGS),
  };
}

/** A private recap of one year of writing, for all diaries or one. */
@Injectable()
export class YearReviewService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(YearReviewMood)
    private readonly moodRepository: Repository<YearReviewMood>,
    private readonly aiCredentialsService: AiCredentialsService,
  ) {}

  async assertOwnedDiary(userId: number, diaryId?: number): Promise<void> {
    if (diaryId && !(await this.diaryRepository.exists({ where: { id: diaryId, userId } }))) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }
  }

  /** The year's entries, oldest first, with word counts. */
  async loadYearEntries(userId: number, year: number, diaryId?: number): Promise<YearEntry[]> {
    const { from, to } = yearRange(year);
    const query = addSameDayOrder(
      this.entryRepository
        .createQueryBuilder('e')
        .select(['e.id', 'e.index', 'e.content', 'e.tags', 'e.isFavorite', 'e.isArchived', 'e.mood', 'e.feelings'])
        .addSelect(`to_char(e.date, 'YYYY-MM-DD')`, 'day')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.date BETWEEN :from AND :to', { from, to })
        .orderBy('e.date', 'ASC'),
      'e',
    );
    if (diaryId) {
      query.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    const { entities, raw } = await query.getRawAndEntities<{ e_id: number; day: string }>();
    const days = new Map(raw.map((row) => [Number(row.e_id), row.day]));
    return entities.map((entry) => ({
      id: entry.id,
      date: days.get(entry.id) as string,
      index: entry.index,
      content: entry.content,
      tags: entry.tags ?? [],
      isFavorite: entry.isFavorite,
      isArchived: entry.isArchived,
      mood: entry.mood ?? null,
      feelings: entry.feelings ?? [],
      words: countWords(entry.content),
    }));
  }

  async getReview(userId: number, year: number, diaryId?: number): Promise<YearReviewDto> {
    await this.assertOwnedDiary(userId, diaryId);
    const [entries, availableYears, previousYear, earlierTags, attachments, mood, credentials] = await Promise.all([
      this.loadYearEntries(userId, year, diaryId),
      this.availableYears(userId, diaryId),
      this.comparison(userId, year - 1, diaryId),
      this.tagsUsedBefore(userId, year, diaryId),
      this.countAttachments(userId, year, diaryId),
      this.moodRepository.findOne({ where: { userId, year, diaryId: diaryId ?? IsNull() } }),
      this.aiCredentialsService.getStatus(userId),
    ]);

    const words = entries.reduce((sum, entry) => sum + entry.words, 0);
    const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, entries: 0, words: 0 }));
    const weekdays: number[] = Array.from({ length: 7 }, () => 0);
    const tagCounts = new Map<string, number>();
    for (const entry of entries) {
      const month = months[Number(entry.date.slice(5, 7)) - 1];
      month.entries++;
      month.words += entry.words;
      weekdays[isoWeekdayIndex(entry.date)]++;
      for (const tag of new Set(entry.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const rankedTags: YearReviewTagDto[] = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((first, second) => second.count - first.count || first.tag.localeCompare(second.tag));

    return {
      year,
      diaryId: diaryId ?? null,
      availableYears,
      totals: {
        entries: entries.length,
        words,
        writingDays: new Set(entries.map((entry) => entry.date)).size,
        longestStreak: longestStreak(entries.map((entry) => entry.date)),
        favorites: entries.filter((entry) => entry.isFavorite).length,
        attachments,
        averageWords: entries.length > 0 ? Math.round(words / entries.length) : 0,
      },
      previousYear,
      months,
      weekdays,
      topTags: rankedTags.slice(0, TOP_TAGS),
      newTags: rankedTags.filter(({ tag }) => !earlierTags.has(tag)).slice(0, NEW_TAGS).map(({ tag }) => tag),
      highlights: this.pickHighlights(entries),
      mood: mood ? toMoodDto(mood) : null,
      recordedMood: summarizeRecordedMoods(entries),
      aiAvailable: credentials.aiAvailable,
    };
  }

  /** The first and last entries, the favorites with the most to say, and the longest entry; archived and empty ones are left out. */
  private pickHighlights(entries: YearEntry[]): YearReviewHighlightDto[] {
    const candidates = entries.filter((entry) => !entry.isArchived && entry.words > 0);
    const first = candidates[0];
    const last = candidates.at(-1);
    const byLength = [...candidates].sort((one, other) => other.words - one.words || one.id - other.id);
    const favorites = byLength
      .filter((entry) => entry.isFavorite && entry.id !== first?.id && entry.id !== last?.id)
      .slice(0, FAVORITE_HIGHLIGHTS)
      .sort((one, other) => one.date.localeCompare(other.date) || one.index - other.index);
    const longest = byLength.find((entry) => ![first, last, ...favorites].some((picked) => picked?.id === entry.id));

    const picks: Array<[YearReviewHighlightDto['kind'], YearEntry | undefined]> = [
      ['first', first],
      ...favorites.map((entry): ['favorite', YearEntry] => ['favorite', entry]),
      ['longest', longest],
      ['last', last && last.id !== first?.id ? last : undefined],
    ];
    return picks
      .filter((pick): pick is [YearReviewHighlightDto['kind'], YearEntry] => pick[1] !== undefined)
      .map(([kind, entry]) => ({
        kind,
        entryId: entry.id,
        date: entry.date,
        excerpt: plainExcerpt(entry.content, EXCERPT_LENGTH),
        words: entry.words,
        tags: entry.tags,
      }));
  }

  private scoped<T extends { andWhere: (condition: string, parameters?: object) => T }>(query: T, diaryId?: number): T {
    return diaryId ? query.andWhere('e.diary_id = :diaryId', { diaryId }) : query;
  }

  private async availableYears(userId: number, diaryId?: number): Promise<number[]> {
    const rows: Array<{ year: string }> = await this.scoped(
      this.entryRepository
        .createQueryBuilder('e')
        .select('DISTINCT EXTRACT(YEAR FROM e.date)::int', 'year')
        .where('e.user_id = :userId', { userId }),
      diaryId,
    )
      .orderBy('year', 'DESC')
      .getRawMany();
    return rows.map((row) => Number(row.year));
  }

  private async comparison(userId: number, year: number, diaryId?: number): Promise<YearReviewComparisonDto | null> {
    const { from, to } = yearRange(year);
    const row: { entries: string; days: string; words: string | null } | undefined = await this.scoped(
      this.entryRepository
        .createQueryBuilder('e')
        .select('COUNT(*)', 'entries')
        .addSelect('COUNT(DISTINCT e.date)', 'days')
        .addSelect(
          String.raw`COALESCE(SUM(CASE WHEN BTRIM(e.content) = '' THEN 0 ELSE CARDINALITY(REGEXP_SPLIT_TO_ARRAY(BTRIM(e.content), '\s+')) END), 0)`,
          'words',
        )
        .where('e.user_id = :userId', { userId })
        .andWhere('e.date BETWEEN :from AND :to', { from, to }),
      diaryId,
    ).getRawOne();
    const entries = Number(row?.entries ?? 0);
    return entries > 0 ? { entries, words: Number(row?.words ?? 0), writingDays: Number(row?.days ?? 0) } : null;
  }

  private async tagsUsedBefore(userId: number, year: number, diaryId?: number): Promise<Set<string>> {
    const rows: Array<{ tag: string }> = await this.scoped(
      this.entryRepository
        .createQueryBuilder('e')
        .select('DISTINCT UNNEST(e.tags)', 'tag')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.date < :from', { from: yearRange(year).from }),
      diaryId,
    ).getRawMany();
    return new Set(rows.map((row) => row.tag));
  }

  private async countAttachments(userId: number, year: number, diaryId?: number): Promise<number> {
    const { from, to } = yearRange(year);
    const query = this.attachmentRepository
      .createQueryBuilder('a')
      .innerJoin('a.entry', 'e')
      .where('a.user_id = :userId', { userId })
      .andWhere('e.date BETWEEN :from AND :to', { from, to });
    return this.scoped(query, diaryId).getCount();
  }
}
