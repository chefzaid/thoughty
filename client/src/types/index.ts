// Entry Types
export interface Entry {
  id: number;
  content: string;
  tags: string[];
  date: string;
  visibility: 'public' | 'private';
  diary_id: number | null;
  diary_name?: string;
  diary_icon?: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface EntryFormData {
  text: string;
  tags: string[];
  date: Date;
  visibility: 'public' | 'private';
  diaryId?: number | null;
}

// Diary Types
export interface Diary {
  id: number;
  name: string;
  icon: string;
  visibility: 'public' | 'private';
  description?: string;
  is_default?: boolean;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface DiaryFormData {
  name: string;
  icon: string;
  description?: string;
}

// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  display_name?: string;
  full_name?: string;
  profile_picture?: string;
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Stats Types
export interface EntryStats {
  totalEntries: number;
  entriesThisMonth: number;
  entriesThisWeek: number;
  longestStreak: number;
  currentStreak: number;
  averageWordsPerEntry: number;
  mostUsedTags: TagCount[];
  entriesByMonth: MonthlyCount[];
  entriesByDayOfWeek: DayCount[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface MonthlyCount {
  month: string;
  count: number;
}

export interface DayCount {
  day: number;
  count: number;
}

// Config Types
export interface AppConfig {
  enableGoogleAuth: boolean;
  enableEmailVerification: boolean;
  maxEntriesPerPage: number;
  maxTagsPerEntry: number;
  maxContentLength: number;
  supportedLanguages: string[];
  defaultLanguage: string;
  defaultTheme: 'light' | 'dark';
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: Record<string, string>;
}

// Filter Types
export interface EntryFilters {
  search?: string;
  tags?: string[];
  date?: string;
  visibility?: 'all' | 'public' | 'private';
  diaryId?: number | null;
  page?: number;
  limit?: number;
}

// Navigation Types
export type ViewType = 'journal' | 'stats' | 'settings' | 'profile';

export interface NavigationState {
  currentView: ViewType;
  year?: string;
  month?: string;
}

// Theme Types
export type Theme = 'light' | 'dark';

// Translation function type
export type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;
