// Navigation and view types

export type ViewType = 'welcome' | 'journal' | 'feed' | 'messages' | 'memoir' | 'memoirSimple' | 'tags' | 'people' | 'tasks' | 'profile' | 'diaries' | 'stats' | 'review' | 'importExport' | 'recycleBin';
export type PublicViewType = 'intro' | 'login' | 'register' | 'completeSignUp' | 'resetPassword' | 'verifyEmail' | 'unsubscribe' | 'about' | 'privacy' | 'terms' | 'contact' | 'feedback' | 'blog' | 'memoirQuestions' | 'journalTemplates';
export type DiaryScopedViewType = 'journal' | 'diaries' | 'tasks' | 'stats' | 'importExport';
export type DiaryReturnViewType = Exclude<DiaryScopedViewType, 'diaries'>;
export type ImportExportSection = 'export' | 'import' | 'book';
export type CloudExportFormat = 'txt' | 'json' | 'md';
export type ImportExportFormat = CloudExportFormat | 'csv' | 'pdf' | 'html' | 'epub' | 'zip';

const DIARY_SCOPED_VIEWS = new Set<ViewType>(['journal', 'diaries', 'tasks', 'stats', 'importExport']);
const DIARY_RETURN_VIEWS = new Set<DiaryReturnViewType>(['journal', 'tasks', 'stats', 'importExport']);
const IMPORT_EXPORT_SECTIONS = new Set<ImportExportSection>(['export', 'import', 'book']);
const IMPORT_EXPORT_FORMATS = new Set<ImportExportFormat>(['txt', 'json', 'md', 'csv', 'pdf', 'html', 'epub', 'zip']);

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
  welcome: '/welcome',
  journal: '/journal',
  feed: '/feed',
  messages: '/messages',
  memoir: '/memoir',
  memoirSimple: '/memoir/simple',
  tags: '/tags',
  people: '/people',
  tasks: '/tasks',
  profile: '/profile',
  diaries: '/diaries',
  stats: '/stats',
  review: '/review',
  importExport: '/import-export',
  recycleBin: '/recycle-bin',
};

export const PUBLIC_VIEW_PATHS: Record<PublicViewType, string> = {
  intro: '/',
  login: '/login',
  register: '/register',
  completeSignUp: '/complete-sign-up',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  unsubscribe: '/unsubscribe',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',
  contact: '/contact',
  feedback: '/feedback',
  blog: '/blog',
  memoirQuestions: '/memoir-questions',
  journalTemplates: '/journal-templates',
};

export function getPathForView(view: ViewType): string {
  return VIEW_PATHS[view];
}

export function getViewForPath(pathname: string): ViewType | null {
  return getViewFromPath(VIEW_PATHS, pathname);
}

/**
 * The public pages search engines index, each in every interface language and the path deciding which:
 * English at the page's own path (also the address for any other language, `x-default`), French under
 * `/fr` (`/fr/` for the presentation page). The sign-in, sign-up and emailed-link pages are not among them.
 */
export const LOCALIZED_PUBLIC_VIEWS = [
  'intro', 'about', 'blog', 'memoirQuestions', 'journalTemplates', 'feedback', 'contact', 'privacy', 'terms',
] as const satisfies readonly PublicViewType[];
export type LocalizedPublicView = typeof LOCALIZED_PUBLIC_VIEWS[number];

/**
 * The languages of the public pages' paths, the interface languages (`Language` in utils/translations,
 * not imported so the build's Node scripts can read this file alone); the first is the one without a prefix.
 */
export const PAGE_LANGUAGES = ['en', 'fr'] as const;
export type PageLanguage = typeof PAGE_LANGUAGES[number];
export const DEFAULT_PAGE_LANGUAGE: PageLanguage = PAGE_LANGUAGES[0];
const LANGUAGE_PATH_PREFIXES: Record<PageLanguage, string> = { en: '', fr: '/fr' };

/** A localized public page and the language its path asks for. */
export interface LocalizedPublicPage {
  readonly view: LocalizedPublicView;
  readonly language: PageLanguage;
}

function isLocalizedPublicView(view: PublicViewType | null): view is LocalizedPublicView {
  return (LOCALIZED_PUBLIC_VIEWS as readonly (PublicViewType | null)[]).includes(view);
}

/** The path of a public page; a localized one in `language` (English by default), the others as they are. */
export function getPublicPathForView(view: PublicViewType, language: PageLanguage = DEFAULT_PAGE_LANGUAGE): string {
  const path = PUBLIC_VIEW_PATHS[view];
  const prefix = isLocalizedPublicView(view) ? LANGUAGE_PATH_PREFIXES[language] : '';
  if (!prefix) return path;
  return path === '/' ? `${prefix}/` : `${prefix}${path}`;
}

/** The localized public page a path opens and the language it asks for, or null for any other path. */
export function getLocalizedPublicPage(pathname: string): LocalizedPublicPage | null {
  const path = normalizePath(pathname);
  const prefixed = PAGE_LANGUAGES.find((language) => {
    const prefix = LANGUAGE_PATH_PREFIXES[language];
    return prefix !== '' && (path === prefix || path.startsWith(`${prefix}/`));
  });
  const language = prefixed ?? DEFAULT_PAGE_LANGUAGE;
  const view = getViewFromPath(PUBLIC_VIEW_PATHS, path.slice(LANGUAGE_PATH_PREFIXES[language].length) || '/');
  return isLocalizedPublicView(view) ? { view, language } : null;
}

/** A localized page's address in each language, and the one for every other language (`x-default`). */
export function getPublicPageAlternates(view: LocalizedPublicView): readonly { readonly hreflang: string; readonly path: string }[] {
  return [
    ...PAGE_LANGUAGES.map((language) => ({ hreflang: language, path: getPublicPathForView(view, language) })),
    { hreflang: 'x-default', path: getPublicPathForView(view, DEFAULT_PAGE_LANGUAGE) },
  ];
}

export function getPublicViewForPath(pathname: string): PublicViewType | null {
  return getLocalizedPublicPage(pathname)?.view ?? getViewFromPath(PUBLIC_VIEW_PATHS, pathname);
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


export interface ProfileStats {
  totalEntries: number;
  uniqueTags: number;
  firstEntryYear: number;
}
