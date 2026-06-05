import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';

@Injectable()
export class DiaryEntryTransferService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Pick<Repository<Entry>, 'update'>,
  ) {}

  async moveEntriesToDiary(userId: number, sourceDiaryId: number, targetDiaryId: number): Promise<void> {
    await this.entryRepository.update({ diaryId: sourceDiaryId, userId }, { diaryId: targetDiaryId });
  }
}