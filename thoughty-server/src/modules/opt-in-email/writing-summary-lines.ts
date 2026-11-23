import { escapeHtml } from '@/common/utils';
import type { WritingSummary } from '@/modules/review/writing-summary';
import type { EmailLanguage } from './opt-in-email-layout';

/** A count already formatted for the language, and the number itself to choose singular or plural. */
export type Plural = (count: string, value: number) => string;

interface SummaryCopy {
  entries: Plural;
  words: Plural;
  writingDays: Plural;
  topTags: (tags: string) => string;
  /** `entries` is already counted, as "4 entries". */
  mood: (average: string, label: string, entries: string) => string;
  quietMood: (label: string) => string;
  moodLevels: [string, string, string, string, string];
}

/** How the recap emails tell a stretch of writing, in both languages. */
const COPY: Record<EmailLanguage, SummaryCopy> = {
  en: {
    entries: (count, value) => `${count} ${value === 1 ? 'entry' : 'entries'}`,
    words: (count, value) => `${count} ${value === 1 ? 'word' : 'words'}`,
    writingDays: (count, value) => `${count} ${value === 1 ? 'day' : 'days'} with writing`,
    topTags: (tags) => `Top tags: ${tags}`,
    mood: (average, label, entries) => `Average mood: ${average} out of 5 (${label}), from ${entries} with a mood.`,
    quietMood: (label) => `Your mood on the whole: ${label}.`,
    moodLevels: ['Very low', 'Low', 'Okay', 'Good', 'Very good'],
  },
  fr: {
    entries: (count, value) => `${count} ${value < 2 ? 'entrée' : 'entrées'}`,
    words: (count, value) => `${count} ${value < 2 ? 'mot' : 'mots'}`,
    writingDays: (count, value) => `${count} ${value < 2 ? 'jour' : 'jours'} d’écriture`,
    topTags: (tags) => `Tags populaires : ${tags}`,
    mood: (average, label, entries) => `Humeur moyenne : ${average} sur 5 (${label}), sur ${entries} avec une humeur.`,
    quietMood: (label) => `Votre humeur dans l’ensemble : ${label}.`,
    moodLevels: ['Très basse', 'Basse', 'Moyenne', 'Bonne', 'Très bonne'],
  },
};

export const formatCount = (value: number, language: EmailLanguage): string => new Intl.NumberFormat(language).format(value);

/** "12 entries", "1 entrée": a count of entries in the email's language. */
export const countEntries = (value: number, language: EmailLanguage): string => COPY[language].entries(formatCount(value, language), value);

const moodLabel = (copy: SummaryCopy, average: number) => copy.moodLevels[Math.min(4, Math.max(0, Math.round(average) - 1))];

/** How much was written: entries, words and days with writing; nothing when there was no entry. */
export function summaryCountLines(summary: WritingSummary, language: EmailLanguage): string[] {
  if (summary.entries === 0) {
    return [];
  }
  const copy = COPY[language];
  return [
    countEntries(summary.entries, language),
    copy.words(formatCount(summary.words, language), summary.words),
    copy.writingDays(formatCount(summary.writingDays, language), summary.writingDays),
  ];
}

/** The most used tags with their counts and the average recorded mood, each only when there is one. */
export function summaryTagAndMoodLines(summary: WritingSummary, language: EmailLanguage): string[] {
  const copy = COPY[language];
  const lines: string[] = [];
  if (summary.topTags.length > 0) {
    lines.push(copy.topTags(summary.topTags.map(({ tag, count }) => `#${tag} (${formatCount(count, language)})`).join(', ')));
  }
  if (summary.mood) {
    const average = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(summary.mood.average);
    lines.push(copy.mood(average, moodLabel(copy, summary.mood.average), countEntries(summary.mood.entries, language)));
  }
  return lines;
}

/** In quiet mode, the same writing without a number: its top tags by name and the mood in words. */
export function quietSummaryLines(summary: WritingSummary, language: EmailLanguage): string[] {
  if (summary.entries === 0) {
    return [];
  }
  const copy = COPY[language];
  return [
    ...(summary.topTags.length > 0 ? [copy.topTags(summary.topTags.map(({ tag }) => `#${tag}`).join(', '))] : []),
    ...(summary.mood ? [copy.quietMood(moodLabel(copy, summary.mood.average))] : []),
  ];
}

export const emailHeading2Html = (text: string): string =>
  `<h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 8px;">${escapeHtml(text)}</h2>`;

/** A titled list of lines as an email section; nothing without lines. */
export function renderLinesSectionHtml(heading: string, lines: string[]): string {
  return lines.length
    ? `
      <section style="border-top: 1px solid #ddd; padding: 16px 0;">
        ${emailHeading2Html(heading)}
        <ul style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0; padding-left: 20px;">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      </section>`
    : '';
}

/** The same section in the plain-text alternative; nothing without lines. */
export function linesSectionText(heading: string, lines: string[]): string[] {
  return lines.length ? [[heading, ...lines.map((line) => `- ${line}`)].join('\n')] : [];
}

/** One link on its own line below a rule, as the recap emails end. */
export function renderLinkParagraphHtml(label: string, url: string): string {
  return `
      <p style="border-top: 1px solid #ddd; font-size: 16px; margin: 0; padding: 16px 0;"><a href="${escapeHtml(url)}" style="color: #4338ca; text-decoration: underline;">${escapeHtml(label)}</a></p>`;
}

/** The year in review's address for a year and, when one is chosen, a diary. */
export function yearReviewUrl(frontendUrl: string, year: number, diaryId: number | null): string {
  const url = new URL('/review', frontendUrl);
  url.searchParams.set('year', String(year));
  if (diaryId !== null) {
    url.searchParams.set('diary', String(diaryId));
  }
  return url.toString();
}
