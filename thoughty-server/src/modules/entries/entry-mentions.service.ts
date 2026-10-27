import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type DeepPartial } from 'typeorm';
import { Entry } from '@/database/entities';
import { syncEntryMentions } from './entry-mentions.sync';

/**
 * Saves entries together with the people they mention: every path that writes an entry's text (the
 * composer, edits, file and app imports) goes through here, so the links always follow the text.
 */
@Injectable()
export class EntryMentionsService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /** Saves one writer's entry, or entries, and relinks each to the people its text mentions, in one transaction. */
  save(userId: number, entry: DeepPartial<Entry>): Promise<Entry>;
  save(userId: number, entries: DeepPartial<Entry>[]): Promise<Entry[]>;
  save(userId: number, value: DeepPartial<Entry> | DeepPartial<Entry>[]): Promise<Entry | Entry[]> {
    return this.entryRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Entry);
      const saved = Array.isArray(value) ? await repository.save(value) : await repository.save(value);
      await syncEntryMentions(manager, userId, Array.isArray(saved) ? saved : [saved]);
      return saved;
    });
  }
}
