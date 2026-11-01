import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { Entry } from '@/database/entities';
import { assertEntryNotSealed } from '@/modules/time-capsules/time-capsule.guard';
import { isWritersDay } from '@/common/utils/writers-day.util';
import { isRereadDayAllowed } from './reread-reminder-dates';

/** Reminders Highlights shows at most. */
export const REREAD_REMINDER_HIGHLIGHT_LIMIT = 10;

/**
 * Reread reminders: one day per entry (`entries.reread_on`) on which the writer asked to read it
 * again. Setting another day replaces it; marking it done or removing it clears it. Entries in the
 * recycle bin and sealed time capsules cannot get one; an entry moved to the bin keeps its reminder
 * and it comes back with the entry.
 */
@Injectable()
export class RereadReminderService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /** Sets or replaces the entry's reminder, for a day from tomorrow up to fifty years after the writer's day. */
  async set(userId: number, entryId: number, rereadOn: string, today: string, now = new Date()): Promise<Entry> {
    if (!isWritersDay(today, now)) {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'today must be the writer’s current day');
    }
    if (!isRereadDayAllowed(rereadOn, today)) {
      throw apiError(BadRequestException, 'REREAD_DATE_INVALID');
    }
    return this.write(userId, entryId, rereadOn);
  }

  /** Removes the entry's reminder, or marks it done from Highlights; nothing happens when it has none. */
  async clear(userId: number, entryId: number): Promise<Entry> {
    return this.write(userId, entryId, null);
  }

  /**
   * The writer's entries due to be reread by their day `today`, in one diary or all of them, longest
   * waiting first. Entries in the recycle bin are left out (TypeORM skips them).
   */
  async findDue(userId: number, diaryId: number | undefined, today: string): Promise<Entry[]> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.reread_on IS NOT NULL')
      .andWhere('e.reread_on <= :today', { today })
      .orderBy('e.reread_on', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .limit(REREAD_REMINDER_HIGHLIGHT_LIMIT);
    if (diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    return qb.getMany();
  }

  private async write(userId: number, entryId: number, rereadOn: string | null): Promise<Entry> {
    const entry = await this.entryRepository.findOne({ where: { id: entryId, userId } });
    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }
    assertEntryNotSealed(entry);
    if (entry.rereadOn === rereadOn) {
      return entry;
    }
    entry.rereadOn = rereadOn;
    return this.entryRepository.save(entry);
  }
}
