import { normalizeEntryTitle, normalizeTimeOfDay } from './entry-order.util';
import { normalizeFeelings, normalizeMood } from './entry-mood.util';
import { type FormatConfig, formatDate, parseDate, validateFormatConfig } from './file-converter-format.util';
import {
  type EntryData,
  type EntryFormat,
  type EntryVisibility,
  moodFields,
  normalizeEntryDate,
  type ParsedEntry,
  sortEntries,
} from './file-converter-entry.util';

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
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
