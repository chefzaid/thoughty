// Entry-related types

export interface Attachment {
  id: number;
  original_filename: string;
  stored_filename: string;
  mimetype: string;
  size: number;
  entry_id?: number | null;
  created_at?: string;
}

export interface Entry {
  id: number;
  content: string;
  tags: string[];
  date: string;
  visibility: 'public' | 'private';
  is_favorite?: boolean;
  is_archived?: boolean;
  format?: 'plain' | 'markdown';
  diary_id?: number | null;
  diary_name?: string;
  diary_icon?: string;
  diary_color?: string | null;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  index?: number;
  attachments?: Attachment[];
}

export interface EntryFormData {
  text: string;
  tags: string[];
  date: Date;
  visibility: 'public' | 'private';
  diaryId?: number | null;
}

export interface GroupedEntries {
  [date: string]: Entry[];
}

export interface SourceEntryInfo {
  id: number;
  date: string;
  index: number;
}

export interface EntryFilters {
  search?: string;
  tags?: string[];
  date?: string;
  visibility?: 'all' | 'public' | 'private';
  favorites?: boolean;
  archiveStatus?: 'all' | 'active' | 'archived';
  diaryId?: number | null;
  page?: number;
  limit?: number;
}

export interface EntriesResponse {
  entries: Entry[];
  totalPages: number;
  allTags: string[];
}

export interface EntryRevision {
  id: number;
  entryId: number;
  content: string;
  tags: string[];
  date: string;
  format: string;
  visibility: string;
  createdAt: string;
}
