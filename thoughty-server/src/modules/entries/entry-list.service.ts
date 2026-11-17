import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { Entry } from '@/database/entities';
import { apiError } from '@/common/errors';
import { hideLockedEntries } from '@/common/content-lock';
import type { EntriesListResponseDto, GetEntriesQueryDto } from './dto';
import { toEntryResponse } from './entry-response.mapper';
import { applyEntryListFilters, entrySearchRank, parseEntryIdsFilter } from './entry-list-filters';
import { EntrySearchService, type PreparedEntrySearch } from './entry-search.service';
import {
  ENTRY_LIST_CURSOR_KEY,
  entryListCursorParameters,
  entryListKey,
  formatEntryListCursor,
  parseEntryListCursor,
  type EntryListPosition,
} from './entry-list-cursor';

interface PositionRow {
  id: number | string;
  list_lead: number | string;
  list_date: string;
  list_time: string | null;
  list_index: number | string;
}

/** Where a batch is read from: the start of the list, after or before a cursor, or around an entry. */
type BatchStart =
  | { from: 'start' }
  | { from: 'after' | 'from' | 'before'; position: EntryListPosition }
  | { from: 'around'; entryId: number };

interface BatchWindow {
  positions: EntryListPosition[];
  hasNext: boolean;
}

function toPosition(row: PositionRow): EntryListPosition {
  return {
    lead: Number(row.list_lead),
    date: row.list_date,
    timeOfDay: row.list_time ?? null,
    index: Number(row.list_index),
    id: Number(row.id),
  };
}

/**
 * The journal list, read a batch at a time for its infinite scroll: the writer's entries the filters match,
 * in the list's order (best match first for a word search sorted by relevance, the given order for a meaning
 * search, else pinned entries first and then newest day first, each day in its own order).
 *
 * A batch starts at the beginning, after the `nextCursor` of the batch before it, before the `prevCursor` of
 * the batch after it, at a batch's own `prevCursor` (to read it again), or around an entry, so the journal opens at a permalink, a month or a random entry and
 * scrolls both ways from there. Cursors hold sort values (`entry-list-cursor.ts`), so entries written or
 * deleted meanwhile neither repeat nor go missing. The entries are found by their sort key first, then read
 * with their diary and files.
 */
@Injectable()
export class EntryListService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly entrySearch: EntrySearchService,
  ) {}

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    const limit = query.limit ?? 10;
    const prepared = query.search ? await this.entrySearch.prepare(query.search) : null;
    const listed = (): { qb: SelectQueryBuilder<Entry>; lead: string } => {
      const qb = this.entryRepository.createQueryBuilder('e').where('e.user_id = :userId', { userId });
      applyEntryListFilters(qb, query, prepared, userId);
      if (query.date) {
        qb.andWhere('e.date = :date', { date: query.date });
      }
      return { qb, lead: this.listLead(qb, query, prepared) };
    };

    const [total, tags, window] = await Promise.all([
      listed().qb.getCount(),
      this.allTags(userId),
      this.readWindow(listed, this.batchStart(query), limit),
    ]);
    const { positions, hasNext } = window;
    const first = positions[0];
    const last = positions.at(-1);
    const [offset, entries] = await Promise.all([
      first ? this.countBefore(listed, first) : Promise.resolve(0),
      this.loadEntries(userId, positions.map((position) => position.id)),
    ]);
    const searchMatches = prepared?.kind === 'text'
      ? await this.entrySearch.findMatches(userId, entries.map((entry) => entry.id), prepared.terms)
      : undefined;

    return {
      entries: entries.map((entry) => ({
        ...toEntryResponse(entry),
        ...(searchMatches ? { search_matches: searchMatches.get(entry.id) ?? [] } : {}),
      })),
      total,
      offset,
      nextCursor: hasNext && last ? formatEntryListCursor(last) : null,
      prevCursor: offset > 0 && first ? formatEntryListCursor(first) : null,
      allTags: tags,
    };
  }

  private batchStart(query: GetEntriesQueryDto): BatchStart {
    if (query.around) return { from: 'around', entryId: query.around };
    if (query.after) return { from: 'after', position: parseEntryListCursor(query.after) };
    if (query.from) return { from: 'from', position: parseEntryListCursor(query.from) };
    if (query.before) return { from: 'before', position: parseEntryListCursor(query.before) };
    return { from: 'start' };
  }

  private async readWindow(
    listed: () => { qb: SelectQueryBuilder<Entry>; lead: string },
    start: BatchStart,
    limit: number,
  ): Promise<BatchWindow> {
    switch (start.from) {
      case 'start': {
        const rows = await this.positions(listed(), limit + 1);
        return { positions: rows.slice(0, limit), hasNext: rows.length > limit };
      }
      case 'after':
      case 'from': {
        const comparison = start.from === 'after' ? '>' : '>=';
        const rows = await this.positions(listed(), limit + 1, { position: start.position, comparison });
        return { positions: rows.slice(0, limit), hasNext: rows.length > limit };
      }
      case 'before': {
        // Read nearest first, shown in list order; the entry the cursor names follows the batch
        const rows = await this.positions(listed(), limit, { position: start.position, comparison: '<' });
        return { positions: rows.reverse(), hasNext: rows.length > 0 };
      }
      case 'around': {
        const target = listed();
        target.qb.andWhere('e.id = :aroundId', { aroundId: start.entryId });
        const [position] = await this.positions(target, 1);
        if (!position) {
          throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
        }
        // Half the batch each way, and more of one side when the other ends sooner
        const [before, after] = await Promise.all([
          this.positions(listed(), limit - 1, { position, comparison: '<' }),
          this.positions(listed(), limit + 1, { position, comparison: '>=' }),
        ]);
        const half = Math.floor(limit / 2);
        const afterTaken = Math.min(after.length, limit - Math.min(before.length, half));
        const beforeTaken = Math.min(before.length, limit - afterTaken);
        return {
          positions: [...before.slice(0, beforeTaken).reverse(), ...after.slice(0, afterTaken)],
          hasNext: after.length > afterTaken,
        };
      }
    }
  }

  /** The sort positions of the listed entries from a place, in list order (nearest first going back). */
  private async positions(
    { qb, lead }: { qb: SelectQueryBuilder<Entry>; lead: string },
    take: number,
    from?: { position: EntryListPosition; comparison: '>' | '>=' | '<' },
  ): Promise<EntryListPosition[]> {
    if (take <= 0) {
      return [];
    }
    const key = entryListKey(lead);
    qb.select('e.id', 'id')
      .addSelect(`CAST(${lead} AS double precision)`, 'list_lead')
      .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'list_date')
      .addSelect("TO_CHAR(e.time_of_day, 'HH24:MI')", 'list_time')
      .addSelect('e.index', 'list_index');
    if (from) {
      qb.andWhere(`${key} ${from.comparison} ${ENTRY_LIST_CURSOR_KEY}`, entryListCursorParameters(from.position));
    }
    const rows = await qb.orderBy(key, from?.comparison === '<' ? 'DESC' : 'ASC').limit(take).getRawMany<PositionRow>();
    return rows.map(toPosition);
  }

  /** How many listed entries come before a position. */
  private countBefore(listed: () => { qb: SelectQueryBuilder<Entry>; lead: string }, position: EntryListPosition): Promise<number> {
    const { qb, lead } = listed();
    return qb
      .andWhere(`${entryListKey(lead)} < ${ENTRY_LIST_CURSOR_KEY}`, entryListCursorParameters(position))
      .getCount();
  }

  /** The entries with their diary and files, in the order of `ids`; one deleted meanwhile is left out. */
  private async loadEntries(userId: number, ids: number[]): Promise<Entry[]> {
    if (ids.length === 0) {
      return [];
    }
    const loaded = await this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .leftJoinAndSelect('e.attachments', 'a')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.id IN (:...ids)', { ids })
      .getMany();
    const byId = new Map(loaded.map((entry) => [entry.id, entry]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** Every tag the writer uses, for the tag filter; a locked entry's only while the request is unlocked. */
  private async allTags(userId: number): Promise<string[]> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .select('DISTINCT UNNEST(e.tags)', 'tag')
      .where('e.user_id = :userId', { userId });
    const rows: Array<{ tag: string }> = await hideLockedEntries(qb, userId).getRawMany();
    return rows.map((row) => row.tag).sort((left, right) => left.localeCompare(right));
  }

  /**
   * The SQL of the list's first sort value, as an ascending number (see `EntryListPosition.lead`): the place
   * among a meaning search's IDs, the negated rank of a word search sorted by relevance, else 0 for a pinned
   * entry and 1 for the others.
   */
  private listLead(qb: SelectQueryBuilder<Entry>, query: GetEntriesQueryDto, prepared: PreparedEntrySearch | null): string {
    const entryIds = parseEntryIdsFilter(query.ids);
    if (entryIds.length > 0) {
      qb.setParameter('semanticOrder', entryIds);
      return 'array_position(CAST(:semanticOrder AS integer[]), e.id)';
    }
    if (prepared?.kind === 'text' && query.sort !== 'date') {
      return `-(${entrySearchRank(qb, prepared)})`;
    }
    return 'CASE WHEN e.is_pinned THEN 0 ELSE 1 END';
  }
}
