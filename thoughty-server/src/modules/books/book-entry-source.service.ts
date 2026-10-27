import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { apiError } from '@/common/errors';
import { EMBEDDED_BOOK_IMAGE_TYPES, stripMarkdown } from '@/common/utils';
import { Diary, Entry, type BookVersionSource } from '@/database/entities';
import { applyEntryListFilters, EntrySearchService } from '@/modules/entries';
import { SavedSearchesService, savedSearchBookScopeKey, toSavedSearchEntryFilters } from '@/modules/saved-searches';
import {
  MAX_PICKED_BOOK_ENTRIES,
  type BookPickedEntriesResponseDto,
  type BookQueryDto,
  type BookSourceKind,
} from './dto';

/** The entries a book is built from, where they came from, and the title it takes when given none. */
export interface BookEntrySelection {
  entries: Entry[];
  source: BookVersionSource;
  defaultTitle?: string;
}

const EXCERPT_LENGTH = 140;

/**
 * The distinct entry IDs of a hand-picked book, in the order given. Refused when there are none
 * or more than one book holds.
 */
export function parsePickedEntryIds(raw: string | undefined): number[] {
  const ids = [...new Set((raw ?? '').split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    throw apiError(BadRequestException, 'BOOK_PICKED_ENTRIES_REQUIRED');
  }
  if (ids.length > MAX_PICKED_BOOK_ENTRIES) {
    throw apiError(
      BadRequestException,
      'BOOK_PICKED_ENTRIES_LIMIT',
      `A book can hold at most ${MAX_PICKED_BOOK_ENTRIES} picked entries`,
    );
  }
  return ids;
}

/** The version history a book belongs to: one per diary (or all diaries), per saved search, and one for hand-picked books. */
export function bookScopeKey(source: BookSourceKind | undefined, diaryId?: number, savedSearchId?: number): string {
  if (source === 'savedSearch') {
    if (!savedSearchId) {
      throw apiError(BadRequestException, 'BOOK_SAVED_SEARCH_REQUIRED');
    }
    return savedSearchBookScopeKey(savedSearchId);
  }
  if (source === 'entries') {
    return 'picked';
  }
  return diaryId ? `diary:${diaryId}` : 'all';
}

/**
 * Selects a book's entries from its source: the journal (a diary or all of them, a date range,
 * archived entries left out), a saved search (its stored filters, applied here as the journal
 * applies them), or entries picked by hand. Every source reads only the writer's own entries, and
 * the entity's soft delete leaves out the recycle bin.
 */
@Injectable()
export class BookEntrySourceService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly savedSearches: SavedSearchesService,
    private readonly entrySearch: EntrySearchService,
  ) {}

  async select(userId: number, query: BookQueryDto): Promise<BookEntrySelection> {
    switch (query.source ?? 'journal') {
      case 'savedSearch':
        return this.fromSavedSearch(userId, query);
      case 'entries':
        return this.fromPickedEntries(userId, query);
      default:
        return this.fromJournal(userId, query);
    }
  }

  /** The picked entries the writer still has, by date, and the IDs that are gone. */
  async describePickedEntries(userId: number, rawIds: string): Promise<BookPickedEntriesResponseDto> {
    const ids = parsePickedEntryIds(rawIds);
    const entries = await this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.id IN (:...ids)', { ids })
      .andWhere('e.sealed_until IS NULL')
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.index', 'ASC')
      .getMany();

    const found = new Set(entries.map((entry) => entry.id));
    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        date: String(entry.date).slice(0, 10),
        title: entry.title ?? null,
        excerpt: excerpt(entry.content),
        diaryId: entry.diaryId ?? null,
        diaryName: entry.diary?.name ?? null,
        isArchived: entry.isArchived,
      })),
      missingIds: ids.filter((id) => !found.has(id)),
    };
  }

  /** The writer's entries for a book; sealed time capsules stay out of books until they open. */
  private baseQuery(userId: number, query: BookQueryDto): SelectQueryBuilder<Entry> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.sealed_until IS NULL')
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.index', 'ASC');
    if (query.embedImages === true) {
      qb.leftJoinAndSelect(
        'e.attachments',
        'bookAttachment',
        'bookAttachment.mimetype IN (:...imageTypes)',
        { imageTypes: EMBEDDED_BOOK_IMAGE_TYPES },
      ).addOrderBy('bookAttachment.created_at', 'ASC');
    }
    return qb;
  }

  private async fromJournal(userId: number, query: BookQueryDto): Promise<BookEntrySelection> {
    const qb = this.baseQuery(userId, query).andWhere('e.is_archived = false');
    if (query.diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId: query.diaryId });
    }
    if (query.dateFrom) {
      qb.andWhere('e.date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('e.date <= :dateTo', { dateTo: query.dateTo });
    }

    const [diary, entries] = await Promise.all([this.resolveDiary(userId, query.diaryId), qb.getMany()]);
    return {
      entries,
      source: { kind: 'journal', diaryId: query.diaryId ?? null },
      defaultTitle: diary?.name,
    };
  }

  private async fromSavedSearch(userId: number, query: BookQueryDto): Promise<BookEntrySelection> {
    if (!query.savedSearchId) {
      throw apiError(BadRequestException, 'BOOK_SAVED_SEARCH_REQUIRED');
    }
    const saved = await this.savedSearches.findOwn(userId, query.savedSearchId);
    const search = saved.filters.search.trim();
    if (search && saved.filters.searchMode === 'semantic') {
      throw apiError(BadRequestException, 'BOOK_SAVED_SEARCH_SEMANTIC');
    }

    const qb = this.baseQuery(userId, query);
    const { filters, date } = toSavedSearchEntryFilters(saved);
    applyEntryListFilters(qb, filters, search ? await this.entrySearch.prepare(search) : null);
    if (date) {
      qb.andWhere('e.date = :date', { date });
    }

    return {
      entries: await qb.getMany(),
      source: { kind: 'savedSearch', savedSearchId: saved.id, savedSearchName: saved.name },
      defaultTitle: saved.name,
    };
  }

  private async fromPickedEntries(userId: number, query: BookQueryDto): Promise<BookEntrySelection> {
    const entryIds = parsePickedEntryIds(query.entryIds);
    const entries = await this.baseQuery(userId, query)
      .andWhere('e.id IN (:...entryIds)', { entryIds })
      .getMany();
    if (new Set(entries.map((entry) => entry.id)).size !== entryIds.length) {
      throw apiError(BadRequestException, 'BOOK_PICKED_ENTRIES_UNAVAILABLE');
    }
    return { entries, source: { kind: 'entries', entryIds } };
  }

  private async resolveDiary(userId: number, diaryId?: number): Promise<Diary | null> {
    if (!diaryId) {
      return null;
    }
    const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
    if (!diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }
    return diary;
  }
}

/** The first words of an entry as plain text on one line. */
function excerpt(content: string): string {
  const text = stripMarkdown(content).replaceAll(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : text;
}
