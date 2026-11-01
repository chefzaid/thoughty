import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { apiError } from '@/common/errors';
import type { EntryReaderResponseDto, GetEntryReaderQueryDto } from './dto';
import { toEntryResponse } from './entry-response.mapper';
import { applyEntryListFilters, applyEntryMonthFilter } from './entry-list-filters';
import { EntrySearchService } from './entry-search.service';

/**
 * Book order: the oldest day first, and each day as the journal orders it (entries without a time first,
 * then by time, then as arranged), whatever the list's own order (pins, relevance). The ID breaks ties so
 * the neighbours never depend on how PostgreSQL happens to read the rows.
 */
const BOOK_ORDER = 'ORDER BY e.date ASC, e.time_of_day ASC NULLS FIRST, e.index ASC, e.id ASC';

interface ReadRow {
  id: number | string;
  previous_id: number | string | null;
  next_id: number | string | null;
  position: number | string;
  total: number | string;
}

const toId = (value: number | string | null): number | null => (value === null ? null : Number(value));

/**
 * The reader: one entry among those the journal filters match (optionally one day or one month of them),
 * read like a book from the oldest, with the entries before and after it.
 *
 * The neighbours come from window functions over the matching entries in book order (`LAG`, `LEAD`,
 * `ROW_NUMBER` and `COUNT`), so one query finds the entry, its place and both neighbours, and only that
 * row leaves the database; the entry itself is then read whole. The list's pages cannot do this cheaply:
 * they follow the list's order (pins first, a search by relevance), so the oldest-first neighbours of an
 * entry could sit on any page. Sealed time capsules are left out of the reading altogether, so a capsule
 * is never shown or counted; entries in the recycle bin are left out by the entity's soft delete.
 */
@Injectable()
export class EntryReaderService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly entrySearch: EntrySearchService,
  ) {}

  async read(userId: number, query: GetEntryReaderQueryDto): Promise<EntryReaderResponseDto> {
    const { search, date, month, entryId } = query;
    const prepared = search ? await this.entrySearch.prepare(search) : null;

    const read = this.entryRepository
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .addSelect(`LAG(e.id) OVER (${BOOK_ORDER})`, 'previous_id')
      .addSelect(`LEAD(e.id) OVER (${BOOK_ORDER})`, 'next_id')
      .addSelect(`ROW_NUMBER() OVER (${BOOK_ORDER})`, 'position')
      .addSelect('COUNT(*) OVER ()', 'total')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.sealed_until IS NULL');
    applyEntryListFilters(read, query, prepared);
    if (date) {
      read.andWhere('e.date = :date', { date });
    }
    if (month) {
      applyEntryMonthFilter(read, month);
    }

    const shown = this.entryRepository.manager
      .createQueryBuilder()
      .select('read.id', 'id')
      .addSelect('read.previous_id', 'previous_id')
      .addSelect('read.next_id', 'next_id')
      .addSelect('read.position', 'position')
      .addSelect('read.total', 'total')
      .from(`(${read.getQuery()})`, 'read')
      .setParameters(read.getParameters());
    if (entryId) {
      shown.where('read.id = :entryId', { entryId });
    } else {
      shown.where('read.position = 1');
    }

    const row = await shown.getRawOne<ReadRow>();
    const entry = row
      ? await this.entryRepository.findOne({ where: { id: Number(row.id), userId }, relations: { diary: true, attachments: true } })
      : null;
    // The entry can go to the recycle bin between the two reads; it is then gone from the reading too
    if (!row || !entry) {
      throw apiError(NotFoundException, entryId ? 'ENTRY_READER_NOT_FOUND' : 'ENTRY_READER_NO_MATCH');
    }

    return {
      entry: toEntryResponse(entry),
      previousId: toId(row.previous_id),
      nextId: toId(row.next_id),
      position: Number(row.position),
      total: Number(row.total),
    };
  }
}
