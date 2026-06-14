// Navigation and view types

export type ViewType = 'journal' | 'tags' | 'profile' | 'diaries' | 'stats' | 'importExport';
export type PublicViewType = 'intro' | 'login' | 'register' | 'about' | 'privacy' | 'terms' | 'contact';
export type DiaryScopedViewType = 'journal' | 'diaries' | 'stats' | 'importExport';
export type DiaryReturnViewType = Exclude<DiaryScopedViewType, 'diaries'>;
export type ImportExportSection = 'export' | 'import' | 'book';
export type CloudExportFormat = 'txt' | 'json' | 'md';
export type ImportExportFormat = CloudExportFormat | 'csv' | 'pdf' | 'html' | 'epub';

const DIARY_SCOPED_VIEWS = new Set<ViewType>(['journal', 'diaries', 'stats', 'importExport']);
const DIARY_RETURN_VIEWS = new Set<DiaryReturnViewType>(['journal', 'stats', 'importExport']);
const IMPORT_EXPORT_SECTIONS = new Set<ImportExportSection>(['export', 'import', 'book']);
const IMPORT_EXPORT_FORMATS = new Set<ImportExportFormat>(['txt', 'json', 'md', 'csv', 'pdf', 'html', 'epub']);

function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}

function getViewFromPath<TView extends string>(paths: Record<TView, string>, pathname: string): TView | null {
  const normalizedPath = normalizePath(pathname);
  const matchedEntry = (Object.entries(paths) as [TView, string][])
    .find(([, path]) => path === normalizedPath);

  return matchedEntry?.[0] ?? null;
}

export const VIEW_PATHS: Record<ViewType, string> = {
  journal: '/journal',
  tags: '/tags',
  profile: '/profile',
  diaries: '/diaries',
  stats: '/stats',
  importExport: '/import-export',
};

export const PUBLIC_VIEW_PATHS: Record<PublicViewType, string> = {
  intro: '/',
  login: '/login',
  register: '/register',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',
  contact: '/contact',
};

export function getPathForView(view: ViewType): string {
  return VIEW_PATHS[view];
}

export function getViewForPath(pathname: string): ViewType | null {
  return getViewFromPath(VIEW_PATHS, pathname);
}

export function getPublicPathForView(view: PublicViewType): string {
  return PUBLIC_VIEW_PATHS[view];
}

export function getPublicViewForPath(pathname: string): PublicViewType | null {
  return getViewFromPath(PUBLIC_VIEW_PATHS, pathname);
}

export function viewSupportsDiarySearch(view: ViewType): view is DiaryScopedViewType {
  return DIARY_SCOPED_VIEWS.has(view);
}

export function formatDiarySearchParam(diaryId: number | null): string {
  return diaryId === null ? 'all' : String(diaryId);
}

export function parseDiarySearchParam(searchParams: URLSearchParams): number | null | undefined {
  const rawDiary = searchParams.get('diary');
  if (rawDiary === null) {
    return undefined;
  }

  if (rawDiary === 'all') {
    return null;
  }

  const diaryId = Number.parseInt(rawDiary, 10);
  if (!Number.isInteger(diaryId) || diaryId <= 0) {
    return undefined;
  }

  return diaryId;
}

export function parseDiaryReturnView(searchParams: URLSearchParams): DiaryReturnViewType | null {
  const rawView = searchParams.get('from');
  if (!rawView) {
    return null;
  }

  return DIARY_RETURN_VIEWS.has(rawView as DiaryReturnViewType)
    ? rawView as DiaryReturnViewType
    : null;
}

export function parseImportExportSection(searchParams: URLSearchParams): ImportExportSection | undefined {
  const rawSection = searchParams.get('section');
  if (!rawSection) {
    return undefined;
  }

  return IMPORT_EXPORT_SECTIONS.has(rawSection as ImportExportSection)
    ? rawSection as ImportExportSection
    : undefined;
}

export function parseImportExportFormat(searchParams: URLSearchParams): ImportExportFormat | undefined {
  const rawFormat = searchParams.get('format');
  if (!rawFormat) {
    return undefined;
  }

  return IMPORT_EXPORT_FORMATS.has(rawFormat as ImportExportFormat)
    ? rawFormat as ImportExportFormat
    : undefined;
}

export function parseBooleanSearchParam(searchParams: URLSearchParams, key: string): boolean | undefined {
  const rawValue = searchParams.get(key);
  if (rawValue === null) {
    return undefined;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  return undefined;
}

export function parseEntrySearchParam(searchParams: URLSearchParams): number | undefined {
  const rawEntryId = searchParams.get('entry');
  if (!rawEntryId) {
    return undefined;
  }

  const entryId = Number.parseInt(rawEntryId, 10);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return undefined;
  }

  return entryId;
}

export interface NavigationState {
  currentView: ViewType;
  year?: string;
  month?: string;
}

export interface ProfileStats {
  totalEntries: number;
  uniqueTags: number;
  firstEntryYear: number;
}
