// Entry-related types

import type { components } from '../generated/openapi';

/**
 * A file attached to an entry. Entries list their attachments with the base fields; an upload or a
 * link answers the full record, with its entry and upload time.
 */
export type Attachment = components['schemas']['AttachmentResponseDto']
  & Partial<Pick<components['schemas']['AttachmentRecordResponseDto'], 'entry_id' | 'created_at'>>;

export interface Entry {
  id: number;
  /** Optional one-line title. */
  title?: string | null;
  /** Optional time of day (`HH:MM`); it orders the day without renumbering it. */
  time_of_day?: string | null;
  /** Optional mood check-in, from 1 (very low) to 5 (very good). Never shown in the public feed. */
  mood?: number | null;
  /** Feeling words: curated ones by their English key, or the writer's own, lowercased. */
  feelings?: string[];
  content: string;
  tags: string[];
  date: string;
  visibility: "public" | "private";
  is_favorite?: boolean;
  is_archived?: boolean;
  is_pinned?: boolean;
  format?: "plain" | "markdown";
  diary_id?: number | null;
  diary_name?: string;
  diary_icon?: string;
  diary_color?: string | null;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  index?: number;
  attachments?: Attachment[];
  /** With a keyword search: the words and phrases of this entry that matched, as written. */
  search_matches?: string[];
}

/** Keyword search results come best match first, or by date as without a search. */
export type EntrySearchSort = 'relevance' | 'date';

export interface GroupedEntries {
  [date: string]: Entry[];
}

export interface SourceEntryInfo {
  id: number;
  date: string;
  index: number;
}

export interface EntriesResponse {
  entries: Entry[];
  totalPages: number;
  allTags: string[];
}

/** An earlier version of an entry, as its history lists it. */
export type EntryRevision = components['schemas']['EntryRevisionResponseDto'];

export interface EntryBacklink {
  id: number;
  title?: string | null;
  time_of_day?: string | null;
  content: string;
  tags: string[];
  date: string;
  index: number;
  format?: "plain" | "markdown";
  visibility?: "public" | "private";
  is_favorite?: boolean;
  is_archived?: boolean;
  is_pinned?: boolean;
  diary_name?: string;
  diary_icon?: string;
  diary_color?: string | null;
}
