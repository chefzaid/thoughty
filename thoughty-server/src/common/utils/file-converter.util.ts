import { normalizeEntryTitle, normalizeTimeOfDay } from './entry-order.util';
import { normalizeFeelings, normalizeMood } from './entry-mood.util';

/**
 * Where TXT files keep entry titles: on the header line as `--{title:…}` (the default, which
 * leaves files without titles exactly as before), or as the first line under the header (an
 * empty line when the entry has none), for plain-text journals that start each entry with one.
 */
export type TitlePlacement = 'header' | 'firstLine';

export interface FormatConfig {
  entrySeparator: string;
  sameDaySeparator: string;
  datePrefix: string;
  dateSuffix: string;
  dateFormat: string;
  tagOpenBracket: string;
  tagCloseBracket: string;
  tagSeparator: string;
  titlePlacement: TitlePlacement;
}

export const DEFAULT_FORMAT: FormatConfig = {
  entrySeparator:
    '--------------------------------------------------------------------------------',
  sameDaySeparator:
    '********************************************************************************',
  datePrefix: '---',
  dateSuffix: '--',
  dateFormat: 'YYYY-MM-DD',
  tagOpenBracket: '[',
  tagCloseBracket: ']',
  tagSeparator: ',',
  titlePlacement: 'header',
};

/**
 * Validate and merge format configuration with defaults
 */
export function validateFormatConfig(config: Partial<FormatConfig> = {}): FormatConfig {
  return {
    entrySeparator: config.entrySeparator || DEFAULT_FORMAT.entrySeparator,
    sameDaySeparator: config.sameDaySeparator || DEFAULT_FORMAT.sameDaySeparator,
    datePrefix: config.datePrefix ?? DEFAULT_FORMAT.datePrefix,
    dateSuffix: config.dateSuffix ?? DEFAULT_FORMAT.dateSuffix,
    dateFormat: config.dateFormat || DEFAULT_FORMAT.dateFormat,
    tagOpenBracket: config.tagOpenBracket ?? DEFAULT_FORMAT.tagOpenBracket,
    tagCloseBracket: config.tagCloseBracket ?? DEFAULT_FORMAT.tagCloseBracket,
    tagSeparator: config.tagSeparator ?? DEFAULT_FORMAT.tagSeparator,
    titlePlacement: config.titlePlacement === 'firstLine' ? 'firstLine' : DEFAULT_FORMAT.titlePlacement,
  };
}

/**
 * Format a date according to the specified format
 */
export function formatDate(date: string | Date, format: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format.replace('YYYY', String(year)).replace('MM', month).replace('DD', day);
}

/**
 * Parse a date string according to the specified format
 */
export function parseDate(dateStr: string, format: string): string {
  const yearIndex = format.indexOf('YYYY');
  const monthIndex = format.indexOf('MM');
  const dayIndex = format.indexOf('DD');

  const year = dateStr.substring(yearIndex, yearIndex + 4);
  const month = dateStr.substring(monthIndex, monthIndex + 2);
  const day = dateStr.substring(dayIndex, dayIndex + 2);

  return `${year}-${month}-${day}`;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

export interface ParsedEntry {
  date: string;
  index: number;
  title?: string;
  timeOfDay?: string;
  mood?: number;
  feelings?: string[];
  tags: string[];
  content: string;
  format: EntryFormat;
  visibility?: EntryVisibility;
  diaryName?: string;
}

export type EntryFormat = 'plain' | 'markdown';
export type EntryVisibility = 'public' | 'private';

interface EntryData {
  date: string | Date;
  index: number;
  title?: string | null;
  timeOfDay?: string | null;
  mood?: number | null;
  feelings?: string[] | null;
  tags: string[];
  content: string;
  format?: EntryFormat;
  visibility?: EntryVisibility;
  diaryName?: string;
}

interface MarkdownParseState {
  currentDate: string | null;
  currentIndex: number;
  currentTitle?: string;
  currentTime?: string;
  currentMood?: number;
  currentFeelings?: string[];
  currentTags: string[];
  currentVisibility?: EntryVisibility;
  currentDiaryName?: string;
  contentLines: string[];
  inEntry: boolean;
}

interface MarkdownMetadata {
  title?: string;
  timeOfDay?: string;
  mood?: number;
  feelings?: string[];
  tags: string[];
  visibility?: EntryVisibility;
  diaryName?: string;
}

function normalizeEntryDate(date: string | Date): string {
  return date instanceof Date
    ? date.toISOString().split('T')[0]
    : String(date).split('T')[0];
}

/**
 * Oldest day first and each day in its numbered order, so importing the file into an empty journal
 * numbers the entries as before and cross-references still point at the same entries. Times are
 * written with each entry and order the day again once it is imported.
 */
function sortEntries(entries: EntryData[]): EntryData[] {
  return [...entries].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.index - b.index;
  });
}

function parseTagList(rawTags: string, separator: string): string[] {
  return rawTags
    .split(separator)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildTextEntryHeader(
  entry: EntryData,
  entryDate: string,
  currentDate: string | null,
  config: FormatConfig,
  includeVisibility: boolean,
): string[] {
  const formatFlag = entry.format === 'markdown' ? '{md}' : '';
  const tagsStr = `${config.tagOpenBracket}${(entry.tags || []).join(config.tagSeparator)}${config.tagCloseBracket}`;
  const visibilityStr = includeVisibility
    ? `--${config.tagOpenBracket}${entry.visibility || 'private'}${config.tagCloseBracket}`
    : '';
  const diaryStr = entry.diaryName ? `--{diary:${entry.diaryName}}` : '';
  const time = normalizeTimeOfDay(entry.timeOfDay);
  const timeStr = time ? ` ${time}` : '';
  const title = normalizeEntryTitle(entry.title);
  const titleStr = title && config.titlePlacement === 'header' ? `--{title:${title}}` : '';
  const metadata = `${config.dateSuffix}${tagsStr}${visibilityStr}${diaryStr}${formatFlag}${textMoodFlags(entry)}${titleStr}`;
  const titleLine = config.titlePlacement === 'firstLine' ? [title ?? ''] : [];

  if (entryDate !== currentDate) {
    const header = `${config.datePrefix}${formatDate(entryDate, config.dateFormat)}${timeStr}${metadata}`;
    if (currentDate === null) {
      return ['', header, ...titleLine];
    }

    return ['', config.entrySeparator, '', header, ...titleLine];
  }

  return ['', config.sameDaySeparator, '', `${config.datePrefix}${entry.index}${timeStr}${metadata}`, ...titleLine];
}

/**
 * `--{mood:4}` and `--{feelings:calm,tired}` for an entry with a mood check-in, written after the
 * Markdown flag and before the title. Entries without one write nothing, so their header lines read
 * exactly as before moods existed, and files written before then import unchanged.
 */
function textMoodFlags(entry: EntryData): string {
  const mood = normalizeMood(entry.mood);
  const feelings = normalizeFeelings(entry.feelings);
  return `${mood ? `--{mood:${mood}}` : ''}${feelings.length > 0 ? `--{feelings:${feelings.join(',')}}` : ''}`;
}

/** A parsed entry's mood and feelings, only when it has them. */
function moodFields(mood: unknown, feelings: unknown): Pick<ParsedEntry, 'mood' | 'feelings'> {
  const level = normalizeMood(mood);
  const words = normalizeFeelings(feelings);
  return { ...(level && { mood: level }), ...(words.length > 0 && { feelings: words }) };
}

function createParsedTextEntry(
  match: RegExpExecArray,
  date: string,
  index: number,
  config: FormatConfig,
): ParsedEntry {
  const timeOfDay = normalizeTimeOfDay(match[2]);
  const visibility = match[4] as EntryVisibility | undefined;
  const diaryName = match[5] || undefined;
  const format: EntryFormat = match[6] ? 'markdown' : 'plain';
  const title = normalizeEntryTitle(match[9]);

  return {
    date,
    index,
    ...(title && { title }),
    ...(timeOfDay && { timeOfDay }),
    ...moodFields(match[7], match[8]),
    tags: parseTagList(match[3], config.tagSeparator),
    content: '',
    format,
    ...(visibility && { visibility }),
    ...(diaryName && { diaryName }),
  };
}

function parseTextHeader(
  trimmedLine: string,
  currentDate: string | null,
  config: FormatConfig,
  datePattern: RegExp,
  indexPattern: RegExp,
): { nextDate: string; nextIndex: number; entry: ParsedEntry } | null {
  const dateMatch = datePattern.exec(trimmedLine);
  if (dateMatch) {
    const nextDate = parseDate(dateMatch[1], config.dateFormat);
    return {
      nextDate,
      nextIndex: 1,
      entry: createParsedTextEntry(dateMatch, nextDate, 1, config),
    };
  }

  if (!currentDate) {
    return null;
  }

  const indexMatch = indexPattern.exec(trimmedLine);
  if (!indexMatch) {
    return null;
  }

  const nextIndex = Number.parseInt(indexMatch[1], 10);
  return {
    nextDate: currentDate,
    nextIndex,
    entry: createParsedTextEntry(indexMatch, currentDate, nextIndex, config),
  };
}

function buildMarkdownMetaLines(entry: EntryData, includeVisibility: boolean): string[] {
  const time = normalizeTimeOfDay(entry.timeOfDay);
  const title = normalizeEntryTitle(entry.title);
  const tagLabels = (entry.tags || []).map((tag) => `\`${tag}\``).join(', ');
  const timeStr = time ? `**Time:** ${time}` : '';
  const titleStr = title ? `**Title:** ${title}` : '';
  const mood = normalizeMood(entry.mood);
  const moodStr = mood ? `**Mood:** ${mood}/5` : '';
  const feelings = normalizeFeelings(entry.feelings);
  const feelingsStr = feelings.length > 0 ? `**Feelings:** ${feelings.join(', ')}` : '';
  const tagsStr = tagLabels ? `**Tags:** ${tagLabels}` : '';
  const visStr = includeVisibility ? `**Visibility:** ${entry.visibility || 'private'}` : '';
  const diaryStr = entry.diaryName ? `**Diary:** ${entry.diaryName}` : '';
  const meta = [timeStr, titleStr, moodStr, feelingsStr, tagsStr, visStr, diaryStr].filter(Boolean).join(' | ');

  return meta ? [meta, ''] : [];
}

function createMarkdownParseState(): MarkdownParseState {
  return {
    currentDate: null,
    currentIndex: 0,
    currentTitle: undefined,
    currentTime: undefined,
    currentMood: undefined,
    currentFeelings: undefined,
    currentTags: [],
    currentVisibility: undefined,
    currentDiaryName: undefined,
    contentLines: [],
    inEntry: false,
  };
}

function finalizeMarkdownEntry(entries: ParsedEntry[], state: MarkdownParseState): MarkdownParseState {
  if (state.currentDate && state.contentLines.length > 0) {
    const content = state.contentLines.join('\n').trim();
    if (content) {
      entries.push({
        date: state.currentDate,
        index: state.currentIndex,
        ...(state.currentTitle && { title: state.currentTitle }),
        ...(state.currentTime && { timeOfDay: state.currentTime }),
        ...moodFields(state.currentMood, state.currentFeelings),
        tags: state.currentTags,
        content,
        format: 'markdown',
        ...(state.currentVisibility && { visibility: state.currentVisibility }),
        ...(state.currentDiaryName && { diaryName: state.currentDiaryName }),
      });
    }
  }

  return {
    ...state,
    currentTitle: undefined,
    currentTime: undefined,
    currentMood: undefined,
    currentFeelings: undefined,
    currentTags: [],
    currentVisibility: undefined,
    currentDiaryName: undefined,
    contentLines: [],
    inEntry: false,
  };
}

function parseMarkdownTag(tag: string): string {
  return tag.trim().replaceAll(/^`|`$/g, '');
}

function parseMarkdownMetadataLine(trimmed: string): MarkdownMetadata | null {
  // Split only known metadata boundaries; diary names can contain ordinary pipes.
  const sections = trimmed.split(/\|(?=[ \t]*\*\*(?:Time|Title|Mood|Feelings|Tags|Visibility|Diary):\*\*)/).map((part) => part.trim());
  const result: MarkdownMetadata = { tags: [] };
  for (const section of sections) {
    if (!applyMarkdownMetadataSection(section, result)) return null;
  }
  return result;
}

function applyMarkdownMetadataSection(section: string, result: MarkdownMetadata): boolean {
  if (section.startsWith('**Time:**')) {
    const time = normalizeTimeOfDay(section.slice('**Time:**'.length));
    if (!time) return false;
    result.timeOfDay = time;
  } else if (section.startsWith('**Title:**')) {
    const title = normalizeEntryTitle(section.slice('**Title:**'.length));
    if (!title) return false;
    result.title = title;
  } else if (section.startsWith('**Mood:**')) {
    const mood = /^([1-5])(?:\s*\/\s*5)?$/.exec(section.slice('**Mood:**'.length).trim());
    if (!mood) return false;
    result.mood = Number(mood[1]);
  } else if (section.startsWith('**Feelings:**')) {
    const feelings = normalizeFeelings(section.slice('**Feelings:**'.length));
    if (feelings.length === 0) return false;
    result.feelings = feelings;
  } else if (section.startsWith('**Tags:**')) {
    const tags = section.slice('**Tags:**'.length).trim();
    if (!tags) return false;
    result.tags = tags.split(',').map(parseMarkdownTag).filter(Boolean);
  } else if (section.startsWith('**Visibility:**')) {
    const visibility = section.slice('**Visibility:**'.length).trim();
    if (visibility !== 'public' && visibility !== 'private') return false;
    result.visibility = visibility;
  } else if (section.startsWith('**Diary:**')) {
    const diary = section.slice('**Diary:**'.length).trim();
    if (!diary) return false;
    result.diaryName = diary;
  } else {
    return false;
  }
  return true;
}

/**
 * Generate text file content from entries
 */
export function generateTextFile(entries: EntryData[], formatConfig: Partial<FormatConfig> = {}, includeVisibility = false): string {
  const config = validateFormatConfig(formatConfig);
  const lines: string[] = [];
  let currentDate: string | null = null;
  const sortedEntries = sortEntries(entries);

  for (const entry of sortedEntries) {
    const entryDate = normalizeEntryDate(entry.date);
    lines.push(...buildTextEntryHeader(entry, entryDate, currentDate, config, includeVisibility));
    currentDate = entryDate;

    lines.push(entry.content || '');
  }

  if (sortedEntries.length > 0) {
    lines.push('', config.entrySeparator);
  }

  return lines.join('\r\n');
}

/**
 * Parse text file content into entry objects
 */
export function parseTextFile(
  content: string,
  formatConfig: Partial<FormatConfig> = {},
): ParsedEntry[] {
  const config = validateFormatConfig(formatConfig);
  const entries: ParsedEntry[] = [];

  // Normalize line endings
  const normalizedContent = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const lines = normalizedContent.split('\n');

  let currentDate: string | null = null;
  let currentEntry: ParsedEntry | null = null;
  let contentLines: string[] = [];

  const escapedPrefix = escapeRegex(config.datePrefix);
  const escapedSuffix = escapeRegex(config.dateSuffix);
  const escapedTagOpen = escapeRegex(config.tagOpenBracket);
  const escapedTagClose = escapeRegex(config.tagCloseBracket);

  // A header holds the date (or the same-day number), an optional time, the tags, and the optional
  // visibility, diary, Markdown flag, mood, feelings, and title, in that order
  const metadataPattern = String.raw`(?: (\d{1,2}:\d{2}))?${escapedSuffix}${escapedTagOpen}([^\]]*?)${escapedTagClose}(?:--${escapedTagOpen}(public|private)${escapedTagClose})?(?:--\{diary:([^}]+)\})?(\{md\})?(?:--\{mood:([1-5])\})?(?:--\{feelings:([^}]*)\})?(?:--\{title:(.*)\})?$`;
  const datePattern = new RegExp(String.raw`^${escapedPrefix}(\d{4}[-./]\d{2}[-./]\d{2})${metadataPattern}`);
  const indexPattern = new RegExp(String.raw`^${escapedPrefix}(\d+)${metadataPattern}`);
  let awaitingTitleLine = false;

  function saveCurrentEntry(): void {
    if (currentEntry) {
      currentEntry.content = contentLines.join('\n').trim();
      if (currentEntry.content) {
        entries.push(currentEntry);
      }
      currentEntry = null;
      contentLines = [];
    }
  }

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === config.entrySeparator || trimmedLine === config.sameDaySeparator) {
      saveCurrentEntry();
      awaitingTitleLine = false;
      continue;
    }

    const parsedHeader = parseTextHeader(trimmedLine, currentDate, config, datePattern, indexPattern);
    if (parsedHeader) {
      saveCurrentEntry();
      currentDate = parsedHeader.nextDate;
      currentEntry = parsedHeader.entry;
      awaitingTitleLine = config.titlePlacement === 'firstLine' && !currentEntry.title;
      continue;
    }

    if (currentEntry && awaitingTitleLine) {
      awaitingTitleLine = false;
      const title = normalizeEntryTitle(line);
      if (title) {
        currentEntry.title = title;
      }
      continue;
    }

    if (currentEntry) {
      contentLines.push(line);
    }
  }

  saveCurrentEntry();

  return entries;
}

/**
 * Find potential duplicates between imported entries and existing entries
 */
export function findDuplicates(
  importedEntries: ParsedEntry[],
  existingEntries: EntryData[],
): { imported: ParsedEntry; existing: EntryData }[] {
  const duplicates: { imported: ParsedEntry; existing: EntryData }[] = [];

  for (const imported of importedEntries) {
    for (const existing of existingEntries) {
      const existingDate =
        existing.date instanceof Date
          ? existing.date.toISOString().split('T')[0]
          : String(existing.date).split('T')[0];
      const sameDate = imported.date === existingDate;
      const sameContent = imported.content.trim() === (existing.content || '').trim();

      if (sameDate && sameContent) {
        duplicates.push({ imported, existing });
        break;
      }
    }
  }

  return duplicates;
}

/**
 * Generate JSON export content from entries
 */
export function generateJsonFile(entries: EntryData[], includeVisibility = false): string {
  const sorted = sortEntries(entries);

  const exportEntries = sorted.map((entry) => {
    const title = normalizeEntryTitle(entry.title);
    const time = normalizeTimeOfDay(entry.timeOfDay);
    const obj: Record<string, unknown> = {
      date: normalizeEntryDate(entry.date),
      index: entry.index,
      ...(time && { time }),
      ...(title && { title }),
      ...moodFields(entry.mood, entry.feelings),
      tags: entry.tags || [],
      content: entry.content || '',
      format: entry.format || 'plain',
    };
    if (includeVisibility) {
      obj.visibility = entry.visibility || 'private';
    }
    if (entry.diaryName) {
      obj.diary = entry.diaryName;
    }
    return obj;
  });

  return JSON.stringify({ entries: exportEntries }, null, 2);
}

function escapeCsvCell(value: string | number | undefined): string {
  const serialized = value === undefined ? '' : String(value);
  return /[",\r\n]/.test(serialized)
    ? `"${serialized.replaceAll('"', '""')}"`
    : serialized;
}

function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Generate CSV export content from entries with per-entry metrics.
 */
export function generateCsvFile(entries: EntryData[], includeVisibility = false): string {
  const sorted = sortEntries(entries);
  const headers = [
    'date',
    'index',
    'time',
    'title',
    'mood',
    'feelings',
    'diary',
    'tags',
    ...(includeVisibility ? ['visibility'] : []),
    'format',
    'word_count',
    'reading_time_minutes',
    'content',
  ];

  const rows = sorted.map((entry) => {
    const content = entry.content || '';
    const wordCount = countWords(content);
    const readingTimeMinutes = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0;
    return [
      normalizeEntryDate(entry.date),
      entry.index,
      normalizeTimeOfDay(entry.timeOfDay) ?? undefined,
      normalizeEntryTitle(entry.title) ?? undefined,
      normalizeMood(entry.mood) ?? undefined,
      normalizeFeelings(entry.feelings).join(';'),
      entry.diaryName,
      (entry.tags || []).join(';'),
      ...(includeVisibility ? [entry.visibility || 'private'] : []),
      entry.format || 'plain',
      wordCount,
      readingTimeMinutes,
      content,
    ].map(escapeCsvCell).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Parse JSON file content into entry objects
 */
export function parseJsonFile(content: string): ParsedEntry[] {
  const data = JSON.parse(content);
  const rawEntries = Array.isArray(data) ? data : data.entries;

  if (!Array.isArray(rawEntries)) {
    return [];
  }

  return rawEntries
    .filter((e: Record<string, unknown>): e is Record<string, unknown> & { date: string; content: string } =>
      typeof e.date === 'string' && e.date.length > 0 && typeof e.content === 'string' && e.content.trim().length > 0
    )
    .map((e: Record<string, unknown> & { date: string; content: string }) => {
      const entry: ParsedEntry = {
        date: e.date.split('T')[0],
        index: typeof e.index === 'number' ? e.index : 1,
        tags: Array.isArray(e.tags) ? (e.tags as string[]).map(String) : [],
        content: e.content.trim(),
        format: e.format === 'markdown' ? 'markdown' : 'plain',
      };
      const title = typeof e.title === 'string' ? normalizeEntryTitle(e.title) : null;
      if (title) {
        entry.title = title;
      }
      const time = typeof e.time === 'string' ? normalizeTimeOfDay(e.time) : null;
      if (time) {
        entry.timeOfDay = time;
      }
      Object.assign(entry, moodFields(e.mood, e.feelings));
      if (e.visibility === 'public' || e.visibility === 'private') {
        entry.visibility = e.visibility;
      }
      if (typeof e.diary === 'string' && e.diary.trim()) {
        entry.diaryName = e.diary.trim();
      }
      return entry;
    });
}

/**
 * Generate Markdown export content from entries
 */
export function generateMarkdownFile(entries: EntryData[], includeVisibility = false): string {
  const sorted = sortEntries(entries);

  const lines: string[] = [];
  let currentDate: string | null = null;

  for (const entry of sorted) {
    const entryDate = normalizeEntryDate(entry.date);
    const isNewDate = entryDate !== currentDate;

    if (isNewDate) {
      if (currentDate !== null) {
        lines.push('');
      }
      currentDate = entryDate;
      lines.push(`# ${entryDate}`, '');
    } else {
      lines.push('', '---', '');
    }

    lines.push(...buildMarkdownMetaLines(entry, includeVisibility), entry.content || '');
  }

  return lines.join('\n');
}

/**
 * Parse Markdown file content into entry objects
 */
export function parseMarkdownFile(content: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const normalizedContent = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const lines = normalizedContent.split('\n');
  let state = createMarkdownParseState();

  for (const line of lines) {
    const trimmed = line.trim();

    const dateMatch = /^#\s+(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    if (dateMatch) {
      state = finalizeMarkdownEntry(entries, state);
      state = { ...state, currentDate: dateMatch[1], currentIndex: 1, inEntry: true };
      continue;
    }

    if (trimmed === '---' && state.currentDate) {
      state = finalizeMarkdownEntry(entries, state);
      state = { ...state, currentIndex: state.currentIndex + 1, inEntry: true };
      continue;
    }

    const metadata = state.inEntry && state.contentLines.every((contentLine) => contentLine.trim() === '')
      ? parseMarkdownMetadataLine(trimmed)
      : null;
    if (metadata) {
      state = {
        ...state,
        currentTitle: metadata.title,
        currentTime: metadata.timeOfDay,
        currentMood: metadata.mood,
        currentFeelings: metadata.feelings,
        currentTags: metadata.tags,
        currentVisibility: metadata.visibility,
        currentDiaryName: metadata.diaryName,
        contentLines: [],
      };
      continue;
    }

    if (state.inEntry) {
      state.contentLines.push(line);
    }
  }

  finalizeMarkdownEntry(entries, state);
  return entries;
}
