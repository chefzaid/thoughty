export interface FormatConfig {
  entrySeparator: string;
  sameDaySeparator: string;
  datePrefix: string;
  dateSuffix: string;
  dateFormat: string;
  tagOpenBracket: string;
  tagCloseBracket: string;
  tagSeparator: string;
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
  tags: string[];
  content: string;
  format?: EntryFormat;
  visibility?: EntryVisibility;
  diaryName?: string;
}

interface MarkdownParseState {
  currentDate: string | null;
  currentIndex: number;
  currentTags: string[];
  currentVisibility?: EntryVisibility;
  currentDiaryName?: string;
  contentLines: string[];
  inEntry: boolean;
}

interface MarkdownMetadata {
  tags: string[];
  visibility?: EntryVisibility;
  diaryName?: string;
}

function normalizeEntryDate(date: string | Date): string {
  return date instanceof Date
    ? date.toISOString().split('T')[0]
    : String(date).split('T')[0];
}

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

  if (entryDate !== currentDate) {
    const formattedDate = formatDate(entryDate, config.dateFormat);
    if (currentDate === null) {
      return ['', `${config.datePrefix}${formattedDate}${config.dateSuffix}${tagsStr}${visibilityStr}${diaryStr}${formatFlag}`];
    }

    return [
      '',
      config.entrySeparator,
      '',
      `${config.datePrefix}${formattedDate}${config.dateSuffix}${tagsStr}${visibilityStr}${diaryStr}${formatFlag}`,
    ];
  }

  return [
    '',
    config.sameDaySeparator,
    '',
    `${config.datePrefix}${entry.index}${config.dateSuffix}${tagsStr}${visibilityStr}${diaryStr}${formatFlag}`,
  ];
}

function createParsedTextEntry(
  match: RegExpExecArray,
  date: string,
  index: number,
  config: FormatConfig,
): ParsedEntry {
  const visibility = match[3] as EntryVisibility | undefined;
  const diaryName = match[4] || undefined;
  const format: EntryFormat = match[5] ? 'markdown' : 'plain';

  return {
    date,
    index,
    tags: parseTagList(match[2], config.tagSeparator),
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
  const tagLabels = (entry.tags || []).map((tag) => `\`${tag}\``).join(', ');
  const tagsStr = tagLabels ? `**Tags:** ${tagLabels}` : '';
  const visStr = includeVisibility ? `**Visibility:** ${entry.visibility || 'private'}` : '';
  const diaryStr = entry.diaryName ? `**Diary:** ${entry.diaryName}` : '';
  const meta = [tagsStr, visStr, diaryStr].filter(Boolean).join(' | ');

  return meta ? [meta, ''] : [];
}

function createMarkdownParseState(): MarkdownParseState {
  return {
    currentDate: null,
    currentIndex: 0,
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
  const tagsMatch = /^\*\*Tags:\*\*\s*(.+?)(?:\s*\|\s*\*\*Visibility:\*\*\s*(public|private))?(?:\s*\|\s*\*\*Diary:\*\*\s*(.+?))?$/.exec(trimmed);
  if (tagsMatch) {
    return {
      tags: tagsMatch[1].split(',').map(parseMarkdownTag).filter(Boolean),
      visibility: tagsMatch[2] as EntryVisibility | undefined,
      diaryName: tagsMatch[3]?.trim() || undefined,
    };
  }

  const visibilityMatch = /^\*\*Visibility:\*\*\s*(public|private)(?:\s*\|\s*\*\*Diary:\*\*\s*(.+?))?$/.exec(trimmed);
  if (visibilityMatch) {
    return {
      tags: [],
      visibility: visibilityMatch[1] as EntryVisibility,
      diaryName: visibilityMatch[2]?.trim() || undefined,
    };
  }

  const diaryMatch = /^\*\*Diary:\*\*\s*(.+)$/.exec(trimmed);
  if (diaryMatch) {
    return {
      tags: [],
      diaryName: diaryMatch[1].trim(),
    };
  }

  return null;
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

  const datePattern = new RegExp(
    String.raw`^${escapedPrefix}(\d{4}[-./]\d{2}[-./]\d{2})${escapedSuffix}${escapedTagOpen}([^\]]*?)${escapedTagClose}(?:--${escapedTagOpen}(public|private)${escapedTagClose})?(?:--\{diary:([^}]+)\})?(\{md\})?$`,
  );

  const indexPattern = new RegExp(
    String.raw`^${escapedPrefix}(\d+)${escapedSuffix}${escapedTagOpen}([^\]]*?)${escapedTagClose}(?:--${escapedTagOpen}(public|private)${escapedTagClose})?(?:--\{diary:([^}]+)\})?(\{md\})?$`,
  );

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
      continue;
    }

    const parsedHeader = parseTextHeader(trimmedLine, currentDate, config, datePattern, indexPattern);
    if (parsedHeader) {
      saveCurrentEntry();
      currentDate = parsedHeader.nextDate;
      currentEntry = parsedHeader.entry;
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
    const obj: Record<string, unknown> = {
      date: normalizeEntryDate(entry.date),
      index: entry.index,
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
