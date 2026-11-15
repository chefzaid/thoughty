import type { Repository } from 'typeorm';
import type { Entry } from '@/database/entities';
import { EntryListService } from './entry-list.service';
import { EntrySearchService } from './entry-search.service';

/** The journal list on a real repository, for the PostgreSQL specs. */
export function entryListOn(entries: Repository<Entry>): EntryListService {
  return new EntryListService(entries, new EntrySearchService(entries));
}
