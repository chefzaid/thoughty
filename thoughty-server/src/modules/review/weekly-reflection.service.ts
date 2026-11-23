import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import { shiftDay } from '@/common/utils/writers-day.util';
import { WeeklyReflection } from '@/database/entities';
import { AiCredentialsService, AiWeeklyReflectionService, type WeeklyReflectionEntry } from '@/modules/ai';
import type { WeeklyReflectionDto, WeeklyReflectionStateDto } from './dto';
import { YearReviewService } from './year-review.service';
import { sampleEvenly } from './year-review-stats';

/** The week a reflection reads: the writer's day and the six days before it. */
export const WEEK_DAYS = 7;
const MAX_ENTRIES = 21;
const CHARACTERS_PER_ENTRY = 1000;

export interface ReflectionWeek {
  readonly from: string;
  readonly to: string;
}

export function weekEndingOn(today: string): ReflectionWeek {
  return { from: shiftDay(today, 1 - WEEK_DAYS), to: today };
}

function toReflectionDto(reflection: WeeklyReflection): WeeklyReflectionDto {
  return {
    weekStart: reflection.weekStart,
    weekEnd: reflection.weekEnd,
    themes: reflection.themes,
    summary: reflection.summary,
    question: reflection.question,
    analyzedEntries: reflection.analyzedEntries,
    generatedAt: reflection.createdAt.toISOString(),
  };
}

/**
 * The weekly reflection: AI reads the past seven days of entries, only when the writer asks, for the
 * themes that came back, a short summary and one question for the week ahead, and the latest one is kept
 * per diary scope. Locked entries are never read, even while unlocked, since the reflection stays on show, nor
 * those of a diary with AI off.
 */
@Injectable()
export class WeeklyReflectionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WeeklyReflection)
    private readonly reflectionRepository: Repository<WeeklyReflection>,
    private readonly yearReviewService: YearReviewService,
    private readonly aiWeeklyReflectionService: AiWeeklyReflectionService,
    private readonly aiCredentialsService: AiCredentialsService,
  ) {}

  /** The week's entries a reflection reads: with words, not archived, up to 21 spread across it, as plain text. */
  private async readableEntries(userId: number, week: ReflectionWeek, diaryId?: number): Promise<WeeklyReflectionEntry[]> {
    const entries = await this.yearReviewService.loadEntries(userId, week, diaryId, { leaveLockedOut: true, forAi: true });
    return entries
      .filter((entry) => !entry.isArchived && entry.words > 0)
      .map((entry) => ({ date: entry.date, text: plainExcerpt(entry.content, CHARACTERS_PER_ENTRY) }));
  }

  async getWeek(userId: number, today: string, diaryId?: number): Promise<WeeklyReflectionStateDto> {
    await this.yearReviewService.assertOwnedDiary(userId, diaryId);
    const week = weekEndingOn(today);
    const [entries, saved, credentials] = await Promise.all([
      this.readableEntries(userId, week, diaryId),
      this.reflectionRepository.findOne({ where: { userId, diaryId: diaryId ?? IsNull() } }),
      this.aiCredentialsService.getStatus(userId),
    ]);
    // A reflection asked on one of these seven days still speaks of this week; an older one is not shown
    const current = saved && saved.weekEnd >= week.from && saved.weekEnd <= week.to ? saved : null;
    return {
      weekStart: week.from,
      weekEnd: week.to,
      entries: entries.length,
      reflection: current ? toReflectionDto(current) : null,
      aiAvailable: credentials.aiAvailable,
    };
  }

  async generate(userId: number, today: string, diaryId?: number): Promise<WeeklyReflectionDto> {
    await this.yearReviewService.assertOwnedDiary(userId, diaryId);
    const week = weekEndingOn(today);
    const entries = sampleEvenly(await this.readableEntries(userId, week, diaryId), MAX_ENTRIES);
    if (entries.length === 0) {
      throw apiError(BadRequestException, 'REVIEW_WEEK_EMPTY');
    }

    const reading = await this.aiWeeklyReflectionService.reflect(userId, week, entries);
    if (!reading) {
      throw apiError(ServiceUnavailableException, 'REVIEW_REFLECTION_UNAVAILABLE');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      await manager.delete(WeeklyReflection, { userId, diaryId: diaryId ?? IsNull() });
      return manager.save(
        manager.create(WeeklyReflection, {
          userId,
          diaryId: diaryId ?? null,
          weekStart: week.from,
          weekEnd: week.to,
          themes: reading.themes,
          summary: reading.summary,
          question: reading.question,
          analyzedEntries: entries.length,
        }),
      );
    });
    return toReflectionDto(saved);
  }
}
