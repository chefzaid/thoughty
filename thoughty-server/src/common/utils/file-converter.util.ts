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

interface ParsedEntry {
  date: string;
  index: number;
  tags: string[];
  content: string;
}

interface EntryData {
  date: string | Date;
  index: number;
  tags: string[];
  content: string;
}

/**
 * Generate text file content from entries
 */
export function generateTextFile(entries: EntryData[], formatConfig: Partial<FormatConfig> = {}): string {
  const config = validateFormatConfig(formatConfig);
  const lines: string[] = [];
  let currentDate: string | null = null;

  // Sort entries by date (ascending) then by index
  const sortedEntries = [...entries].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.index - b.index;
  });

  for (const entry of sortedEntries) {
    const entryDate =
      entry.date instanceof Date
        ? entry.date.toISOString().split('T')[0]
        : String(entry.date).split('T')[0];
    const isNewDate = entryDate !== currentDate;

    if (isNewDate) {
      if (currentDate !== null) {
        lines.push('', config.entrySeparator);
      }
      currentDate = entryDate;

      const formattedDate = formatDate(entryDate, config.dateFormat);
      const tagsStr =
        config.tagOpenBracket + (entry.tags || []).join(config.tagSeparator) + config.tagCloseBracket;
      lines.push('', `${config.datePrefix}${formattedDate}${config.dateSuffix}${tagsStr}`);
    } else {
      const tagsStr =
        config.tagOpenBracket + (entry.tags || []).join(config.tagSeparator) + config.tagCloseBracket;
      lines.push('', config.sameDaySeparator, '', `${config.datePrefix}${entry.index}${config.dateSuffix}${tagsStr}`);
    }

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
  let currentIndex = 0;
  let currentEntry: ParsedEntry | null = null;
  let contentLines: string[] = [];

  const escapedPrefix = escapeRegex(config.datePrefix);
  const escapedSuffix = escapeRegex(config.dateSuffix);
  const escapedTagOpen = escapeRegex(config.tagOpenBracket);
  const escapedTagClose = escapeRegex(config.tagCloseBracket);

  const datePattern = new RegExp(
    String.raw`^${escapedPrefix}(\d{4}[-./]\d{2}[-./]\d{2})${escapedSuffix}${escapedTagOpen}([^\]]*?)${escapedTagClose}$`,
  );

  const indexPattern = new RegExp(
    String.raw`^${escapedPrefix}(\d+)${escapedSuffix}${escapedTagOpen}([^\]]*?)${escapedTagClose}$`,
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

    const dateMatch = datePattern.exec(trimmedLine);
    if (dateMatch) {
      saveCurrentEntry();
      currentDate = parseDate(dateMatch[1], config.dateFormat);
      currentIndex = 1;
      const tags = dateMatch[2]
        .split(config.tagSeparator)
        .map((t) => t.trim())
        .filter(Boolean);
      currentEntry = {
        date: currentDate,
        index: currentIndex,
        tags,
        content: '',
      };
      continue;
    }

    const indexMatch = indexPattern.exec(trimmedLine);
    if (indexMatch && currentDate) {
      saveCurrentEntry();
      currentIndex = Number.parseInt(indexMatch[1], 10);
      const tags = indexMatch[2]
        .split(config.tagSeparator)
        .map((t) => t.trim())
        .filter(Boolean);
      currentEntry = {
        date: currentDate,
        index: currentIndex,
        tags,
        content: '',
      };
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
