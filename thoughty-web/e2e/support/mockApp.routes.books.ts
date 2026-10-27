import type { components } from "../../src/generated/openapi";
import { type MockAppState, type MockBookVersion, type MockEntry } from "./mockApp.shared";
import { fulfillApiError, fulfillJson, readQueryFlag, type RouteContext } from "./mockApp.route-utils";
import { getFilteredEntries } from "./mockApp.routes.entries";
import { byStart, mockEraContains, type MockLifeEra } from "./mockApp.routes.life-eras";
import { buildMockBookPdf } from "./mockBookPdf";

type BookPreview = components["schemas"]["BookPreviewResponseDto"];
type BookSource = MockBookVersion["source"];

const MAX_PICKED_ENTRIES = 500;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface BookSelection {
  entries: MockEntry[];
  source: BookSource;
  defaultTitle?: string;
}

const chronological = (entries: MockEntry[]) =>
  [...entries].sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index);

class BookRefusal {
  constructor(readonly status: number, readonly code: string, readonly message: string) {}
}

function pickedIds(raw: string | null): number[] {
  const ids = [...new Set((raw ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) throw new BookRefusal(400, "BOOK_PICKED_ENTRIES_REQUIRED", "Pick at least one entry for the book");
  if (ids.length > MAX_PICKED_ENTRIES) throw new BookRefusal(400, "BOOK_PICKED_ENTRIES_LIMIT", "Too many picked entries for one book");
  return ids;
}

/** The entries a book request selects, as `BookEntrySourceService` selects them. */
function selectEntries(state: MockAppState, params: URLSearchParams): BookSelection {
  const source = params.get("source") ?? "journal";
  if (source === "entries") {
    const ids = pickedIds(params.get("entryIds"));
    const entries = state.entries.filter((entry) => ids.includes(entry.id));
    if (entries.length !== ids.length) {
      throw new BookRefusal(400, "BOOK_PICKED_ENTRIES_UNAVAILABLE", "Some picked entries no longer exist or are in the recycle bin.");
    }
    return { entries, source: { kind: "entries", entryIds: ids } };
  }

  if (source === "savedSearch") {
    if (!params.get("savedSearchId")) throw new BookRefusal(400, "BOOK_SAVED_SEARCH_REQUIRED", "Choose a saved search");
    const saved = state.savedSearches.find((candidate) => candidate.id === Number(params.get("savedSearchId")));
    if (!saved) throw new BookRefusal(404, "SAVED_SEARCH_NOT_FOUND", "Saved search not found");
    if (saved.filters.searchMode === "semantic" && saved.filters.search.trim()) {
      throw new BookRefusal(400, "BOOK_SAVED_SEARCH_SEMANTIC", "A book cannot be built from a meaning search.");
    }
    const filters = new URLSearchParams({
      search: saved.filters.search,
      sort: "date",
      tags: saved.filters.tags.join(","),
      date: saved.filters.date ?? "",
      visibility: saved.filters.visibility === "all" ? "" : saved.filters.visibility,
      favorites: String(saved.filters.favorites),
      archiveStatus: saved.filters.archiveStatus,
      mood: saved.filters.mood,
      diaryId: saved.diaryId === null ? "" : String(saved.diaryId),
      eraId: saved.filters.eraId ? String(saved.filters.eraId) : "",
      personId: saved.filters.personId ? String(saved.filters.personId) : "",
    });
    return {
      entries: getFilteredEntries(state, filters).filtered,
      source: { kind: "savedSearch", savedSearchId: saved.id, savedSearchName: saved.name },
      defaultTitle: saved.name,
    };
  }

  const diaryId = params.get("diaryId");
  const diary = state.diaries.find((candidate) => String(candidate.id) === diaryId);
  const entries = state.entries.filter((entry) => !entry.is_archived && (!diaryId || String(entry.diaryId ?? 1) === diaryId));
  return { entries, source: { kind: "journal", diaryId: diaryId ? Number(diaryId) : null }, defaultTitle: diary?.name };
}

interface MockChapter {
  title: string;
  entries: MockEntry[];
}

const DAY_MS = 86_400_000;

/** Among the eras that cover the date, the shortest (an ongoing one lasting until today), then the latest to start. */
function mostSpecificEra(eras: MockLifeEra[], date: string): MockLifeEra | undefined {
  const today = new Date().toISOString().slice(0, 10);
  const until = date > today ? date : today;
  const length = (era: MockLifeEra) => (Date.parse(era.endDate ?? until) - Date.parse(era.startDate)) / DAY_MS;
  return eras
    .filter((era) => mockEraContains(era, date))
    .sort((left, right) => length(left) - length(right) || right.startDate.localeCompare(left.startDate) || left.name.localeCompare(right.name))[0];
}

/** One chapter per life era in era order, each entry in its most specific era, then "Other" unless left out. */
function buildEraChapters(entries: MockEntry[], eras: MockLifeEra[], params: URLSearchParams): MockChapter[] {
  const ordered = [...eras].sort(byStart);
  const chapters = new Map<number, MockChapter>();
  const outside: MockEntry[] = [];
  for (const entry of chronological(entries)) {
    const era = mostSpecificEra(ordered, entry.date);
    if (!era) {
      outside.push(entry);
      continue;
    }
    const chapter = chapters.get(era.id) ?? { title: era.name, entries: [] };
    chapter.entries.push(entry);
    chapters.set(era.id, chapter);
  }
  const result = ordered.flatMap((era) => chapters.get(era.id) ?? []);
  if (outside.length > 0 && readQueryFlag(params, "includeUntagged", true)) result.push({ title: "Other", entries: outside });
  return result;
}

/** Chapters as `buildBook` groups them: by tag (alphabetical, untagged last), year, month, era, or one chapter. */
function buildChapters(entries: MockEntry[], params: URLSearchParams, title: string, eras: MockLifeEra[]): MockChapter[] {
  const mode = params.get("chapterMode") ?? "tags";
  if (mode === "eras") return buildEraChapters(entries, eras, params);
  const chapters = new Map<string, MockChapter>();
  const place = (key: string, chapterTitle: string, entry: MockEntry) => {
    const chapter = chapters.get(key) ?? { title: chapterTitle, entries: [] };
    chapter.entries.push(entry);
    chapters.set(key, chapter);
  };

  for (const entry of chronological(entries)) {
    const [year, month] = entry.date.split("-");
    if (mode === "single") place("single", title, entry);
    else if (mode === "year") place(year!, year!, entry);
    else if (mode === "month") place(`${year}-${month}`, `${MONTHS[Number(month) - 1]} ${year}`, entry);
    else if (entry.tags.length > 0) entry.tags.forEach((tag) => place(`tag:${tag.toLowerCase()}`, tag, entry));
    else if (readQueryFlag(params, "includeUntagged", true)) place("~untagged", "Untagged Thoughts", entry);
  }

  const result = [...chapters.entries()];
  if (mode === "tags") result.sort(([left], [right]) => left.localeCompare(right));
  return result.map(([, chapter]) => chapter);
}

function buildBook(state: MockAppState, params: URLSearchParams) {
  const selection = selectEntries(state, params);
  const title = params.get("title")?.trim() || selection.defaultTitle || "My Book of Thoughts";
  return { title, source: selection.source, chapters: buildChapters(selection.entries, params, title, state.lifeEras) };
}

function toPreview(book: ReturnType<typeof buildBook>): BookPreview {
  return {
    title: book.title,
    author: "testuser",
    chapterCount: book.chapters.length,
    entryCount: book.chapters.reduce((total, chapter) => total + chapter.entries.length, 0),
    chapters: book.chapters.map((chapter) => ({
      title: chapter.title,
      entryCount: chapter.entries.length,
      firstDate: chapter.entries[0]!.date,
      lastDate: chapter.entries.at(-1)!.date,
    })),
  };
}

const BOOK_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

/** The generated book file, as `BooksService.export` names it: a real PDF, or the other formats' text. */
function exportBook(state: MockAppState, params: URLSearchParams) {
  const book = buildBook(state, params);
  const format = params.get("format") || "pdf";
  const chapters = book.chapters.map((chapter) => ({ title: chapter.title, paragraphs: chapter.entries.map((entry) => entry.content) }));
  const body = format === "pdf"
    ? buildMockBookPdf({ title: book.title, author: params.get("author")?.trim() || "testuser", includeToc: readQueryFlag(params, "includeToc", true), chapters })
    : [`# ${book.title}`, ...chapters.map((chapter) => `## ${chapter.title}\n\n${chapter.paragraphs.join("\n\n")}`)].join("\n\n");
  return {
    body,
    contentType: BOOK_CONTENT_TYPES[format] ?? "application/octet-stream",
    filename: `thoughty_book_${book.title.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}_2026-08-01.${format}`,
  };
}

/** The version history a book belongs to, as `bookScopeKey` names it. */
function scopeOf(source: BookSource): string {
  if (source.kind === "savedSearch") return `search:${source.savedSearchId}`;
  if (source.kind === "entries") return "picked";
  return source.diaryId ? `diary:${source.diaryId}` : "all";
}

function requestedScope(params: URLSearchParams): string {
  const source = params.get("source");
  if (source === "savedSearch") return `search:${params.get("savedSearchId")}`;
  if (source === "entries") return "picked";
  return params.get("diaryId") ? `diary:${params.get("diaryId")}` : "all";
}

function createVersion(state: MockAppState, params: URLSearchParams): MockBookVersion {
  const book = buildBook(state, params);
  const scope = scopeOf(book.source);
  const previous = state.bookVersions.find((version) => scopeOf(version.source) === scope);
  const versionNumber = (previous?.versionNumber ?? 0) + 1;
  const manifest = previous ? state.bookVersionManifests[previous.id] : undefined;
  const previousIds = new Set(manifest?.entryIds ?? []);
  const previousChapters = new Set(manifest?.chapterTitles ?? []);
  const entryIds = [...new Set(book.chapters.flatMap((chapter) => chapter.entries.map((entry) => entry.id)))];
  const format = (params.get("format") || "pdf") as MockBookVersion["format"];
  const version: MockBookVersion = {
    id: 100 + state.bookVersions.length + 1,
    versionNumber,
    title: book.title,
    format,
    filename: `thoughty_book_${book.title}_2026-08-01_v${versionNumber}.${format}`,
    chapterCount: book.chapters.length,
    entryCount: book.chapters.reduce((total, chapter) => total + chapter.entries.length, 0),
    addedEntryCount: entryIds.filter((id) => !previousIds.has(id)).length,
    addedChapterTitles: book.chapters.map((chapter) => chapter.title).filter((title) => !previousChapters.has(title.toLowerCase())),
    source: book.source,
    createdAt: "2026-08-01T12:00:00.000Z",
  };
  state.bookVersionManifests[version.id] = {
    entryIds,
    chapterTitles: book.chapters.map((chapter) => chapter.title.toLowerCase()),
  };
  state.bookVersions.unshift(version);
  return version;
}

/** `/api/books/*`: outline preview, export, picked entries, saved versions and cloud upload, built from the mock journal. */
export async function handleBookRoutes({ route, request, url, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (!pathname.startsWith("/api/books/")) return false;

  try {
    return await answerBookRoute({ route, request, url, pathname, searchParams, state });
  } catch (error) {
    if (!(error instanceof BookRefusal)) throw error;
    await fulfillApiError(route, error.status, error.code, error.message);
    return true;
  }
}

async function answerBookRoute({ route, request, url, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  const method = request.method();

  if (pathname === "/api/books/preview" && method === "GET") {
    state.lastBookPreviewRequestUrl = url;
    await fulfillJson(route, toPreview(buildBook(state, searchParams)));
    return true;
  }

  if (pathname === "/api/books/export" && (method === "GET" || method === "POST")) {
    state.bookExportRequestUrls.push(url);
    const file = exportBook(state, searchParams);
    await route.fulfill({
      status: 200,
      contentType: file.contentType,
      headers: { "Content-Disposition": `attachment; filename="${file.filename}"` },
      body: file.body,
    });
    return true;
  }

  if (pathname === "/api/books/picked-entries" && method === "GET") {
    const ids = pickedIds(searchParams.get("entryIds"));
    const entries = chronological(state.entries.filter((entry) => ids.includes(entry.id)));
    await fulfillJson(route, {
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        title: entry.title ?? null,
        excerpt: entry.content.replaceAll(/\s+/g, " ").trim().slice(0, 140),
        diaryId: entry.diaryId ?? 1,
        diaryName: state.diaries.find((diary) => diary.id === (entry.diaryId ?? 1))?.name ?? null,
        isArchived: entry.is_archived ?? false,
      })),
      missingIds: ids.filter((id) => !entries.some((entry) => entry.id === id)),
    });
    return true;
  }

  if (pathname === "/api/books/versions" && method === "GET") {
    const scope = requestedScope(searchParams);
    await fulfillJson(route, state.bookVersions.filter((version) => scopeOf(version.source) === scope));
    return true;
  }

  if (pathname === "/api/books/versions" && method === "POST") {
    state.lastBookVersionRequestUrl = url;
    await fulfillJson(route, createVersion(state, searchParams), { status: 201 });
    return true;
  }

  const versionDownload = /^\/api\/books\/versions\/(\d+)\/download$/.exec(pathname);
  if (versionDownload && method === "GET") {
    state.lastBookVersionDownloadId = Number(versionDownload[1]);
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: { "Content-Disposition": 'attachment; filename="saved-book-v1.pdf"' },
      body: "%PDF- saved version",
    });
    return true;
  }

  if (pathname === "/api/books/upload" && method === "POST") {
    state.lastBookUploadRequestUrl = url;
    state.lastBookUploadRequestBody = request.postData();
    await fulfillJson(
      route,
      {
        id: "cloud-book-1",
        name: `thoughty_book_${url.searchParams.get("title") || "book"}.${url.searchParams.get("format") || "pdf"}`,
        size: 4096,
        modifiedAt: "2026-07-23T12:00:00.000Z",
      },
      { status: 201 },
    );
    return true;
  }

  return false;
}
