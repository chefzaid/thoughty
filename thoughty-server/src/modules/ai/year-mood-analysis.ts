import { extractJsonCandidate } from '@/common/utils/json-content.util';

export interface YearMoodSampleEntry {
  date: string;
  text: string;
}

export interface YearMoodSample {
  /** `YYYY-MM` */
  month: string;
  entries: YearMoodSampleEntry[];
}

export interface YearMoodMonthReading {
  month: string;
  mood: string;
  valence: number;
}

export interface YearMoodReading {
  months: YearMoodMonthReading[];
  summary: string;
}

const MAX_MOOD_LENGTH = 32;
const MAX_SUMMARY_LENGTH = 400;
const CLINICAL_TERMS = /\b(?:depress(?:ion|ed)|anxiety disorder|bipolar|diagnos\w*|disorder|therapy needed)\b|(?:^|[^\p{L}])(?:dépression|trouble anxieux|bipolaire|diagnostic)(?=$|[^\p{L}])/iu;

export const YEAR_MOOD_INSTRUCTIONS = [
  'You read samples of one person\'s journal entries, grouped by month, and describe the emotional arc of their year.',
  'Return only JSON shaped as {"months":[{"month":"YYYY-MM","mood":"...","valence":0}],"summary":"..."}.',
  'Give every month you are sent exactly once and no other month.',
  'mood is one or two lowercase words; valence is an integer from -2 (very low) to 2 (very bright).',
  'summary is at most two short sentences on how the year moved, with no markdown.',
  'Ground every mood in the entries. Do not diagnose, label conditions, or give advice.',
  'Write moods and the summary in the predominant language of the entries.',
].join(' ');

export function buildYearMoodPrompt(samples: YearMoodSample[]): string {
  return samples
    .map((sample) => [`Month ${sample.month}`, ...sample.entries.map((entry) => `- ${entry.date}: ${entry.text}`)].join('\n'))
    .join('\n\n');
}

function parseMonth(value: unknown, allowedMonths: Set<string>): YearMoodMonthReading | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { month, mood, valence } = value as Record<string, unknown>;
  const label = typeof mood === 'string' ? mood.trim().toLowerCase().replaceAll(/\s+/g, ' ').slice(0, MAX_MOOD_LENGTH) : '';
  const score = typeof valence === 'number' ? valence : Number.parseFloat(String(valence));
  if (typeof month !== 'string' || !allowedMonths.has(month) || !label || !Number.isFinite(score) || CLINICAL_TERMS.test(label)) {
    return null;
  }
  return { month, mood: label, valence: Math.max(-2, Math.min(2, Math.round(score))) };
}

/** Keeps only the months that were asked about, in calendar order, or null when the answer is unusable. */
export function parseYearMood(rawContent: string, requestedMonths: string[]): YearMoodReading | null {
  const candidate = extractJsonCandidate(rawContent, '{') ?? '{}';
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const allowed = new Set(requestedMonths);
    const byMonth = new Map<string, YearMoodMonthReading>();
    for (const item of Array.isArray(parsed.months) ? parsed.months : []) {
      const reading = parseMonth(item, allowed);
      if (reading && !byMonth.has(reading.month)) {
        byMonth.set(reading.month, reading);
      }
    }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, MAX_SUMMARY_LENGTH) : '';
    if (byMonth.size === 0 || !summary || CLINICAL_TERMS.test(summary)) {
      return null;
    }
    return { months: [...byMonth.values()].sort((first, second) => first.month.localeCompare(second.month)), summary };
  } catch {
    return null;
  }
}
