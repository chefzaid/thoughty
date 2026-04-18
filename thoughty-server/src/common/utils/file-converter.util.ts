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
  format: 'plain' | 'markdown';
  visibility?: 'public' | 'private';
  diaryName?: string;
}

interface EntryData {
  date: string | Date;
  index: number;
  tags: string[];
  content: string;
  format?: 'plain' | 'markdown';
  visibility?: 'public' | 'private';
  diaryName?: string;
}

/**
 * Generate text file content from entries
 */
export function generateTextFile(entries: EntryData[], formatConfig: Partial<FormatConfig> = {}, includeVisibility = false): string {
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

    const formatFlag = entry.format === 'markdown' ? '{md}' : '';
    const tagsStr =
      config.tagOpenBracket + (entry.tags || []).join(config.tagSeparator) + config.tagCloseBracket;
    const visibilityStr = includeVisibility
      ? `--${config.tagOpenBracket}${entry.visibility || 'private'}${config.tagCloseBracket}`
      : '';
    const diaryStr = entry.diaryName
      ? `--{diary:${entry.diaryName}}`
      : '';

    if (isNewDate) {
      if (currentDate !== null) {
        lines.push('', config.entrySeparator);
      }
      currentDate = entryDate;

      const formattedDate = formatDate(entryDate, config.dateFormat);
      lines.push('', `${config.datePrefix}${formattedDate}${config.dateSuffix}${tagsStr}${visibilityStr}${diaryStr}${formatFlag}`);
    } else {
      lines.push('', config.sameDaySeparator, '', `${config.datePrefix}${entry.index}${config.dateSuffix}${tagsStr}${visibilityStr}${diaryStr}${formatFlag}`);
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

    const dateMatch = datePattern.exec(trimmedLine);
    if (dateMatch) {
      saveCurrentEntry();
      currentDate = parseDate(dateMatch[1], config.dateFormat);
      currentIndex = 1;
      const tags = dateMatch[2]
        .split(config.tagSeparator)
        .map((t) => t.trim())
        .filter(Boolean);
      const visibility = dateMatch[3] as 'public' | 'private' | undefined;
      const diaryName = dateMatch[4] || undefined;
      const format: 'plain' | 'markdown' = dateMatch[5] ? 'markdown' : 'plain';
      currentEntry = {
        date: currentDate,
        index: currentIndex,
        tags,
        content: '',
        format,
        ...(visibility && { visibility }),
        ...(diaryName && { diaryName }),
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
      const visibility = indexMatch[3] as 'public' | 'private' | undefined;
      const diaryName = indexMatch[4] || undefined;
      const format: 'plain' | 'markdown' = indexMatch[5] ? 'markdown' : 'plain';
      currentEntry = {
        date: currentDate,
        index: currentIndex,
        tags,
        content: '',
        format,
        ...(visibility && { visibility }),
        ...(diaryName && { diaryName }),
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

/**
 * Generate JSON export content from entries
 */
export function generateJsonFile(entries: EntryData[], includeVisibility = false): string {
  const sorted = [...entries].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.index - b.index;
  });

  const exportEntries = sorted.map((entry) => {
    const date =
      entry.date instanceof Date
        ? entry.date.toISOString().split('T')[0]
        : String(entry.date).split('T')[0];
    const obj: Record<string, unknown> = {
      date,
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
    .filter((e: Record<string, unknown>) => e.date && e.content && typeof e.content === 'string' && (e.content as string).trim())
    .map((e: Record<string, unknown>) => {
      const entry: ParsedEntry = {
        date: String(e.date).split('T')[0],
        index: typeof e.index === 'number' ? e.index : 1,
        tags: Array.isArray(e.tags) ? (e.tags as string[]).map(String) : [],
        content: String(e.content).trim(),
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
  const sorted = [...entries].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.index - b.index;
  });

  const lines: string[] = [];
  let currentDate: string | null = null;

  for (const entry of sorted) {
    const entryDate =
      entry.date instanceof Date
        ? entry.date.toISOString().split('T')[0]
        : String(entry.date).split('T')[0];
    const isNewDate = entryDate !== currentDate;

    if (isNewDate) {
      if (currentDate !== null) {
        lines.push('');
      }
      currentDate = entryDate;
      lines.push(`# ${entryDate}`);
      lines.push('');
    } else {
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const tagsStr = (entry.tags || []).length > 0
      ? `**Tags:** ${(entry.tags || []).map((t) => `\`${t}\``).join(', ')}`
      : '';
    const visStr = includeVisibility
      ? `**Visibility:** ${entry.visibility || 'private'}`
      : '';
    const diaryStr = entry.diaryName
      ? `**Diary:** ${entry.diaryName}`
      : '';

    const meta = [tagsStr, visStr, diaryStr].filter(Boolean).join(' | ');
    if (meta) {
      lines.push(meta);
      lines.push('');
    }

    lines.push(entry.content || '');
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

  let currentDate: string | null = null;
  let currentIndex = 0;
  let currentTags: string[] = [];
  let currentVisibility: 'public' | 'private' | undefined;
  let currentDiaryName: string | undefined;
  let contentLines: string[] = [];
  let inEntry = false;

  function saveCurrentEntry(): void {
    if (currentDate && contentLines.length > 0) {
      const content = contentLines.join('\n').trim();
      if (content) {
        const entry: ParsedEntry = {
          date: currentDate,
          index: currentIndex,
          tags: currentTags,
          content,
          format: 'markdown',
        };
        if (currentVisibility) {
          entry.visibility = currentVisibility;
        }
        if (currentDiaryName) {
          entry.diaryName = currentDiaryName;
        }
        entries.push(entry);
      }
    }
    contentLines = [];
    currentTags = [];
    currentVisibility = undefined;
    currentDiaryName = undefined;
    inEntry = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Date heading: # YYYY-MM-DD
    const dateMatch = /^#\s+(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    if (dateMatch) {
      saveCurrentEntry();
      currentDate = dateMatch[1];
      currentIndex = 1;
      inEntry = true;
      continue;
    }

    // Same-day separator: ---
    if (trimmed === '---' && currentDate) {
      saveCurrentEntry();
      currentIndex++;
      inEntry = true;
      continue;
    }

    // Tags/visibility/diary metadata line
    const tagsMatch = /^\*\*Tags:\*\*\s*(.+?)(?:\s*\|\s*\*\*Visibility:\*\*\s*(public|private))?(?:\s*\|\s*\*\*Diary:\*\*\s*(.+?))?$/.exec(trimmed);
    if (tagsMatch && inEntry && contentLines.every((l) => l.trim() === '')) {
      currentTags = tagsMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/^`|`$/g, ''))
        .filter(Boolean);
      if (tagsMatch[2]) {
        currentVisibility = tagsMatch[2] as 'public' | 'private';
      }
      if (tagsMatch[3]) {
        currentDiaryName = tagsMatch[3].trim();
      }
      contentLines = [];
      continue;
    }

    // Visibility-only or visibility+diary metadata line
    const visOnlyMatch = /^\*\*Visibility:\*\*\s*(public|private)(?:\s*\|\s*\*\*Diary:\*\*\s*(.+?))?$/.exec(trimmed);
    if (visOnlyMatch && inEntry && contentLines.every((l) => l.trim() === '')) {
      currentVisibility = visOnlyMatch[1] as 'public' | 'private';
      if (visOnlyMatch[2]) {
        currentDiaryName = visOnlyMatch[2].trim();
      }
      contentLines = [];
      continue;
    }

    // Diary-only metadata line
    const diaryOnlyMatch = /^\*\*Diary:\*\*\s*(.+)$/.exec(trimmed);
    if (diaryOnlyMatch && inEntry && contentLines.every((l) => l.trim() === '')) {
      currentDiaryName = diaryOnlyMatch[1].trim();
      contentLines = [];
      continue;
    }

    if (inEntry) {
      contentLines.push(line);
    }
  }

  saveCurrentEntry();
  return entries;
}
