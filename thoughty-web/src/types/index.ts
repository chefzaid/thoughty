// Re-export all types from separate modules
export * from './entry';
export * from './diary';
export * from './config';
export * from './navigation';
export * from './common';

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
  avatarUrl?: string;
  authProvider?: 'local' | 'google';
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

