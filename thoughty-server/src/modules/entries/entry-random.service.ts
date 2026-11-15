import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { apiError } from '@/common/errors';
import type { GetRandomEntryQueryDto, RandomEntryResponseDto } from './dto';
import { applyEntryListFilters } from './entry-list-filters';
import { EntrySearchService } from './entry-search.service';

interface PickedRow {
  id: number;
  date: string;
  index: number;
}

/**
 * One entry picked at random among those the journal filters match, so the journal can open the list
 * around it without leaving the filters.
 *
 * PostgreSQL picks one with `ORDER BY random() LIMIT 1`, so every match is equally likely and only the
 * picked row leaves the database. A writer's journal is thousands of entries at most, which one scan reads
 * in milliseconds; counting first and reading at a random offset would scan the same rows twice and could
 * miss when an entry changes in between. Sealed time capsules are never picked; entries in the recycle bin
 * are left out by the entity's soft delete.
 */
@Injectable()
export class EntryRandomService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly entrySearch: EntrySearchService,
  ) {}

  async pick(userId: number, query: GetRandomEntryQueryDto): Promise<RandomEntryResponseDto> {
    const { search, date, excludeId } = query;
    const prepared = search ? await this.entrySearch.prepare(search) : null;

    const picked = this.entryRepository
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'date')
      .addSelect('e.index', 'index')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.sealed_until IS NULL');
    applyEntryListFilters(picked, query, prepared);
    if (date) {
      picked.andWhere('e.date = :date', { date });
    }
    // The entry picked last time comes back only when nothing else matches
    if (excludeId) {
      picked.orderBy('e.id = :excludeId', 'ASC').setParameter('excludeId', excludeId).addOrderBy('RANDOM()');
    } else {
      picked.orderBy('RANDOM()');
    }

    const row = await picked.limit(1).getRawOne<PickedRow>();
    if (!row) {
      throw apiError(NotFoundException, 'ENTRY_RANDOM_NO_MATCH');
    }

    return { id: Number(row.id), date: row.date, index: Number(row.index) };
  }
}
