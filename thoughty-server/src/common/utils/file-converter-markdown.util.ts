import { normalizeEntryTitle, normalizeTimeOfDay } from './entry-order.util';
import { normalizeFeelings, normalizeMood } from './entry-mood.util';
import {
  type EntryData,
  type EntryVisibility,
  moodFields,
  normalizeEntryDate,
  type ParsedEntry,
  sortEntries,
} from './file-converter-entry.util';

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
