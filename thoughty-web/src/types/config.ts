// Configuration and settings types

export interface Config {
  entriesPerPage?: string | number;
  language?: string;
  theme?: 'light' | 'dark';
  name?: string;
  bio?: string;
  email?: string;
  birthday?: string;
  gender?: string;
  avatarUrl?: string;
  defaultVisibility?: 'public' | 'private';
  readDates?: boolean;
  openRouterModel?: string;
  autoTagMaxTags?: string | number;
  tagMetadata?: string;
}

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

export type Theme = 'light' | 'dark';
export type Visibility = 'public' | 'private';
export type VisibilityFilter = 'all' | 'public' | 'private';
export type ArchiveStatusFilter = 'all' | 'active' | 'archived';
