import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Diary, Entry } from '@/database/entities';
import { measureDiaryGoal, type DayWriting } from './diary-goal-progress';
import type { DiaryGoalProgressDto } from './dto';
import { ENTRY_WORDS_SQL } from './stats-sql';

interface DayRow {
  diaryId: number | string;
  day: string;
  entries: number | string;
  words: number | string;
}

/** Progress towards the writing goals of the writer's diaries, measured up to their own day. */
@Injectable()
export class StatsGoalService {
  constructor(
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /** The one diary's goal when `diaryId` is set, otherwise every diary's that has one, in diary order. */
  async analyze(userId: number, diaryId: number | undefined, today: string): Promise<DiaryGoalProgressDto[]> {
    const diaries = await this.diaryRepository.find({
      where: { userId, goalType: Not(IsNull()), ...(diaryId ? { id: diaryId } : {}) },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    if (diaries.length === 0) return [];

    const rows: DayRow[] = await this.entryRepository
      .createQueryBuilder('e')
      .select('e.diary_id', 'diaryId')
      .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'entries')
      .addSelect(`COALESCE(SUM(${ENTRY_WORDS_SQL}), 0)`, 'words')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.diary_id IN (:...diaryIds)', { diaryIds: diaries.map((diary) => diary.id) })
      .andWhere('e.date <= :today', { today })
      .groupBy('e.diary_id')
      .addGroupBy('e.date')
      .getRawMany();

    const daysByDiary = new Map<number, Map<string, DayWriting>>();
    for (const row of rows) {
      const id = Number(row.diaryId);
      const days = daysByDiary.get(id) ?? new Map<string, DayWriting>();
      days.set(row.day, { entries: Number(row.entries), words: Number(row.words) });
      daysByDiary.set(id, days);
    }

    return diaries.flatMap((diary) => {
      if (!diary.goalType || !diary.goalTarget) return [];
      return [{
        diaryId: diary.id,
        diaryName: diary.name,
        diaryIcon: diary.icon,
        goalType: diary.goalType,
        goalTarget: diary.goalTarget,
        ...measureDiaryGoal(diary.goalType, diary.goalTarget, daysByDiary.get(diary.id) ?? new Map(), today),
      }];
    });
  }
}
