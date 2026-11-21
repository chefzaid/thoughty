import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { runWithoutUnlock } from '@/common/content-lock';
import { localDateIn } from '@/common/utils/time-zone.util';
import { Diary } from '@/database/entities';
import { EntriesService } from '@/modules/entries/entries.service';
import type { EntryResponseDto, GetEntriesQueryDto } from '@/modules/entries/dto';
import type { AuthenticatedAccessToken } from './access-tokens.service';
import {
  PublicCreateEntryDto,
  PublicCreatedEntryResponseDto,
  PublicDiaryListResponseDto,
  PublicEntriesQueryDto,
  PublicEntryDto,
  PublicEntryListResponseDto,
} from './dto';

const DEFAULT_PAGE_SIZE = 20;

function toPublicEntry(entry: EntryResponseDto): PublicEntryDto {
  return {
    id: entry.id,
    diaryId: entry.diary_id,
    date: entry.date,
    index: entry.index,
    title: entry.title,
    timeOfDay: entry.time_of_day,
    text: entry.content,
    format: entry.format,
    tags: entry.tags,
    mood: entry.mood,
    feelings: entry.feelings,
    visibility: entry.visibility,
    withheld: entry.withheld,
    sealedUntil: entry.sealed_until,
    createdAt: entry.created_at,
  };
}

/**
 * What a personal access token can reach: the writer's diaries, their journal list a page at a time, and
 * new private entries. It runs on the journal's own services, so tags, mentions and the list follow the
 * same rules as in the app, and it never carries a PIN unlock: locked content stays withheld.
 */
@Injectable()
export class PublicApiService {
  constructor(
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly entriesService: EntriesService,
  ) {}

  async listDiaries(userId: number): Promise<PublicDiaryListResponseDto> {
    const diaries = await this.diaryRepository.find({ where: { userId }, order: { position: 'ASC', id: 'ASC' } });
    return {
      diaries: diaries.map(({ id, name, icon, isDefault, isLocked }) => ({ id, name, icon, isDefault, isLocked })),
    };
  }

  async listEntries(userId: number, query: PublicEntriesQueryDto): Promise<PublicEntryListResponseDto> {
    const listQuery: GetEntriesQueryDto = {
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
      after: query.after,
      diaryId: query.diaryId,
      search: query.search,
    };
    const page = await runWithoutUnlock(() => this.entriesService.getEntries(userId, listQuery));
    return { entries: page.entries.map(toPublicEntry), nextCursor: page.nextCursor };
  }

  /** A private entry, for the day sent or else today in the token's time zone. */
  async createEntry(
    token: AuthenticatedAccessToken,
    dto: PublicCreateEntryDto,
    now = new Date(),
  ): Promise<PublicCreatedEntryResponseDto> {
    const date = dto.date ?? localDateIn(now, token.timeZone);
    const { entryId } = await this.entriesService.create(token.userId, {
      ...dto,
      tags: dto.tags ?? [],
      date,
      visibility: 'private',
    });
    return { id: entryId, date };
  }
}
