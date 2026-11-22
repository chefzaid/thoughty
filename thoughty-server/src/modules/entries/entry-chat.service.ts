import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { hideLockedEntries } from '@/common/content-lock';
import { stripMarkdown } from '@/common/utils';
import { Entry } from '@/database/entities';
import {
  AiEntriesChatService,
  MAX_ENTRIES_CHAT_ENTRIES,
  MAX_ENTRIES_CHAT_ENTRY_LENGTH,
  MAX_ENTRIES_CHAT_TOTAL_LENGTH,
  parseEntriesChatCitations,
  type EntriesChatSource,
} from '@/modules/ai';
import type { EntryChatDto, EntryChatEntryDto, EntryChatQueryDto, EntryChatResponseDto } from './dto';
import { applyEntryListFilters } from './entry-list-filters';
import { EntrySearchService } from './entry-search.service';

interface ChatEntryRow {
  id: number | string;
  date: string;
  title: string | null;
  content: string;
  total: number | string;
}

/** An entry as the conversation reads it: its words on one line, cut to the length each entry gets. */
function readableText(content: string): string {
  const text = stripMarkdown(content).replaceAll(/\s+/g, ' ').trim();
  return text.length > MAX_ENTRIES_CHAT_ENTRY_LENGTH
    ? `${text.slice(0, MAX_ENTRIES_CHAT_ENTRY_LENGTH - 1).trimEnd()}…`
    : text;
}

/**
 * The newest rows that fit the length the entries may take together (always the newest one), oldest first,
 * so the conversation reads them in the order they were lived.
 */
function fitToBudget(rows: readonly ChatEntryRow[]): Array<{ row: ChatEntryRow; text: string }> {
  const kept: Array<{ row: ChatEntryRow; text: string }> = [];
  let length = 0;
  for (const row of rows) {
    const text = readableText(row.content);
    if (kept.length > 0 && length + text.length > MAX_ENTRIES_CHAT_TOTAL_LENGTH) {
      break;
    }
    kept.push({ row, text });
    length += text.length;
  }
  return kept.reverse();
}

/**
 * A conversation with the AI about several entries at once: those the journal filters match (the list's day,
 * or a date range, among them), the newest fifty at most, which the replies cite by number. Each request reads
 * the entries afresh, so nothing of the conversation is kept. Sealed time capsules are never read, nor locked
 * entries unless the request is unlocked; entries in the recycle bin are left out by the entity's soft delete.
 */
@Injectable()
export class EntryChatService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly entrySearch: EntrySearchService,
    private readonly aiEntriesChat: AiEntriesChatService,
  ) {}

  async chat(userId: number, query: EntryChatQueryDto, dto: EntryChatDto): Promise<EntryChatResponseDto> {
    const rows = await this.readEntries(userId, query);
    if (rows.length === 0) {
      throw apiError(NotFoundException, 'ENTRY_CHAT_NO_MATCH');
    }

    const read = fitToBudget(rows);
    const sources: EntriesChatSource[] = read.map(({ row, text }) => ({ date: row.date, title: row.title, text }));
    const reply = await this.aiEntriesChat.reply(userId, sources, dto.messages);
    const entries: EntryChatEntryDto[] = read.map(({ row }, index) => ({
      ref: index + 1,
      id: Number(row.id),
      date: row.date,
      title: row.title,
    }));

    return { reply, entries, cited: parseEntriesChatCitations(reply, entries.length), total: Number(rows[0].total) };
  }

  /** The newest matching entries, newest first, each with how many match in all. */
  private async readEntries(userId: number, query: EntryChatQueryDto): Promise<ChatEntryRow[]> {
    const { search, date, dateFrom, dateTo } = query;
    const prepared = search ? await this.entrySearch.prepare(search) : null;

    const qb = this.entryRepository
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'date')
      .addSelect('e.title', 'title')
      .addSelect('e.content', 'content')
      .addSelect('COUNT(*) OVER ()', 'total')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.sealed_until IS NULL');
    applyEntryListFilters(qb, query, prepared, userId);
    hideLockedEntries(qb, userId);
    if (date) {
      qb.andWhere('e.date = :date', { date });
    }
    if (dateFrom) {
      qb.andWhere('e.date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('e.date <= :dateTo', { dateTo });
    }

    return qb
      .orderBy('e.date', 'DESC')
      .addOrderBy('e.time_of_day', 'DESC', 'NULLS LAST')
      .addOrderBy('e.index', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .limit(MAX_ENTRIES_CHAT_ENTRIES)
      .getRawMany<ChatEntryRow>();
  }
}
