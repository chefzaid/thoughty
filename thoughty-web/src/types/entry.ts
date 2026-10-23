// Entry-related types

export interface Attachment {
  id: number;
  original_filename: string;
  stored_filename: string;
  mimetype: string;
  size: number;
  entry_id?: number | null;
  created_at?: string;
  transcript?: string | null;
  transcribed_at?: string | null;
}

export interface Entry {
  id: number;
  /** Optional one-line title. */
  title?: string | null;
  /** Optional time of day (`HH:MM`); it orders the day without renumbering it. */
  time_of_day?: string | null;
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

export interface EntryRevision {
  id: number;
  entryId: number;
  title?: string | null;
  timeOfDay?: string | null;
  content: string;
  tags: string[];
  date: string;
  format: string;
  visibility: string;
  createdAt: string;
}

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
