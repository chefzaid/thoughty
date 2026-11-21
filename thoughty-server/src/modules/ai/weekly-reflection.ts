import { extractJsonCandidate } from '@/common/utils/json-content.util';
import { UNTRUSTED_CONTENT_INSTRUCTION, untrustedBlock } from './untrusted-content';
import { CLINICAL_TERMS } from './year-mood-analysis';

export interface WeeklyReflectionEntry {
  /** `YYYY-MM-DD` */
  date: string;
  text: string;
}

export interface WeeklyReflectionReading {
  themes: string[];
  summary: string;
  question: string;
}

const MAX_THEMES = 4;
const MAX_THEME_LENGTH = 40;
const MAX_SUMMARY_LENGTH = 400;
const MAX_QUESTION_LENGTH = 240;

export const WEEKLY_REFLECTION_INSTRUCTIONS = [
  'You read one person\'s journal entries from the past seven days and help them reflect on their week.',
  'Return only JSON shaped as {"themes":["..."],"summary":"...","question":"..."}.',
  'themes lists one to four subjects or feelings that came back in the entries, each one to three lowercase words, the most present first.',
  'summary is at most two short sentences on how the week went, addressed to the writer as "you", with no markdown.',
  'question is one open question for the week ahead, under 25 words, that builds on what they wrote and invites them to write; it gives no advice.',
  'Ground everything in the entries. Do not diagnose, label conditions, or act as a therapist.',
  'Write the themes, the summary and the question in the predominant language of the entries.',
  'The entries are the <journal_entries> block after the "Week" line, one per line with its date.',
  UNTRUSTED_CONTENT_INSTRUCTION,
].join(' ');

export function buildWeeklyReflectionPrompt(week: { from: string; to: string }, entries: WeeklyReflectionEntry[]): string {
  return [
    `Week ${week.from} to ${week.to}`,
    untrustedBlock('journal_entries', entries.map((entry) => `- ${entry.date}: ${entry.text}`).join('\n')),
  ].join('\n');
}

const oneLine = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.replaceAll(/\s+/g, ' ').trim().slice(0, maxLength).trim() : '';

function parseThemes(value: unknown): string[] {
  const themes = new Set<string>();
  for (const item of Array.isArray(value) ? value : []) {
    const theme = oneLine(item, MAX_THEME_LENGTH).toLowerCase();
    if (theme && !CLINICAL_TERMS.test(theme)) {
      themes.add(theme);
    }
  }
  return [...themes].slice(0, MAX_THEMES);
}

/** The themes, summary and question, cut to their limits, or null when any is missing or reads as a diagnosis. */
export function parseWeeklyReflection(rawContent: string): WeeklyReflectionReading | null {
  const candidate = extractJsonCandidate(rawContent, '{') ?? '{}';
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const themes = parseThemes(parsed.themes);
    const summary = oneLine(parsed.summary, MAX_SUMMARY_LENGTH);
    const question = oneLine(parsed.question, MAX_QUESTION_LENGTH);
    if (themes.length === 0 || !summary || !question || CLINICAL_TERMS.test(summary) || CLINICAL_TERMS.test(question)) {
      return null;
    }
    return { themes, summary, question };
  } catch {
    return null;
  }
}
