import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, Entry } from '@/database/entities';
import { apiError } from '@/common/errors';
import { ContentLockedException, assertEntryUnlocked, isContentUnlocked } from '@/common/content-lock';
import { ContentPinService } from './content-pin.service';

/**
 * Locking and unlocking a diary or an entry. Locking needs a PIN to unlock with and makes it private
 * (database triggers then keep its entries private and copy a diary's lock to them); lifting a lock
 * needs the request to be unlocked, so a stolen session cannot simply switch the lock off.
 */
@Injectable()
export class ContentLocksService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly pins: ContentPinService,
  ) {}

  async setEntryLocked(userId: number, id: number, locked: boolean): Promise<Entry> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    if (locked) {
      await this.pins.assertPinSet(userId);
    } else {
      assertEntryUnlocked(entry);
    }
    await this.entryRepository.update({ id, userId }, { isLocked: locked });
    return this.entryRepository.findOneOrFail({ where: { id, userId }, relations: { diary: true, attachments: true } });
  }

  async setDiaryLocked(userId: number, id: number, locked: boolean): Promise<Diary> {
    const diary = await this.diaryRepository.findOne({ where: { id, userId } });
    if (!diary) throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    if (locked) {
      await this.pins.assertPinSet(userId);
    } else if (diary.isLocked && !isContentUnlocked(userId)) {
      throw apiError(ContentLockedException, 'CONTENT_LOCKED');
    }
    await this.diaryRepository.update({ id, userId }, locked ? { isLocked: true, visibility: 'private' } : { isLocked: false });
    return this.diaryRepository.findOneOrFail({ where: { id, userId } });
  }
}
