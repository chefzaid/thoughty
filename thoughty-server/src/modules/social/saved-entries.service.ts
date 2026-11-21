import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { Entry, SavedEntry } from '@/database/entities';
import type { SavedStateDto } from './dto';
import { findFeedVisibleEntry } from './public-feed-visibility';

/**
 * The reader's private Saved list of other writers' public entries. Nobody else sees it: the author is
 * not told, and a save counts in no like, karma or leaderboard. An entry leaves it once the feed may
 * no longer show it (a trigger drops its saves; see the `SavedEntries` migration).
 */
@Injectable()
export class SavedEntriesService {
  constructor(
    @InjectRepository(SavedEntry)
    private readonly savedEntryRepository: Repository<SavedEntry>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async setSaved(userId: number, entryId: number, save: boolean): Promise<SavedStateDto> {
    const entry = await findFeedVisibleEntry(this.entryRepository, entryId);
    if (save && entry.userId === userId) {
      throw apiError(BadRequestException, 'SOCIAL_CANNOT_SAVE_OWN_ENTRY');
    }

    if (save) {
      await this.savedEntryRepository
        .createQueryBuilder()
        .insert()
        .into(SavedEntry)
        .values({ userId, entryId })
        .orIgnore()
        .execute();
    } else {
      await this.savedEntryRepository.delete({ userId, entryId });
    }
    return { saved: save };
  }

  /** Which of `entryIds` the reader has saved. */
  async findSavedIds(userId: number, entryIds: number[]): Promise<Set<number>> {
    if (entryIds.length === 0) return new Set();

    const rows = await this.savedEntryRepository.find({
      where: { userId, entryId: In(entryIds) },
      select: { entryId: true },
    });
    return new Set(rows.map((row) => row.entryId));
  }
}
