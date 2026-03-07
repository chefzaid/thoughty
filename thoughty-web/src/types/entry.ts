// Entry-related types

export interface Entry {
  id: number;
  content: string;
  tags: string[];
  date: string;
  visibility: 'public' | 'private';
  diary_id?: number | null;
  diary_name?: string;
  diary_icon?: string;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  index?: number;
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
  diaryId?: number | null;
  page?: number;
  limit?: number;
}

export interface EntriesResponse {
  entries: Entry[];
  totalPages: number;
  allTags: string[];
}
