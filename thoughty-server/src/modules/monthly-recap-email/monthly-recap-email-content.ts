import { escapeHtml } from '@/common/utils';
import type { RenderedEmail } from '@/modules/auth/services/email.service';
import {
  buildEntryCard,
  COMMON_EMAIL_COPY,
  type EmailLanguage,
  entryCardText,
  oneClickUnsubscribeHeaders,
  renderEmailDocument,
  renderEmailText,
  renderEntryCardHtml,
} from '@/modules/opt-in-email/opt-in-email-layout';
import type { MonthlyRecap } from './monthly-recap.service';

type Plural = (count: string, value: number) => string;

interface RecapCopy {
  subject: (month: string) => string;
  intro: (month: string) => string;
  quiet: (month: string) => string;
  numbersHeading: string;
  entries: Plural;
  words: Plural;
  writingDays: Plural;
  topTags: (tags: string) => string;
  /** `entries` is already counted, as "4 entries". */
  mood: (average: string, label: string, entries: string) => string;
  moodLevels: [string, string, string, string, string];
  memoryHeading: (monthOfYear: string) => string;
  review: (year: number) => string;
  footer: string;
}

/** French elides "de" before a vowel: "d’octobre", but "de mars". */
const frenchOf = (text: string) => (/^[aeiouéâ]/i.test(text) ? `d’${text}` : `de ${text}`);

const COPY: Record<EmailLanguage, RecapCopy> = {
  en: {
    subject: (month) => `Your ${month} in your journal`,
    intro: (month) => `A look back at what you wrote in ${month}.`,
    quiet: (month) => `You didn’t write in ${month}. Here is a memory from an earlier year instead.`,
    numbersHeading: 'Your month in numbers',
    entries: (count, value) => `${count} ${value === 1 ? 'entry' : 'entries'}`,
    words: (count, value) => `${count} ${value === 1 ? 'word' : 'words'}`,
    writingDays: (count, value) => `${count} ${value === 1 ? 'day' : 'days'} with writing`,
    topTags: (tags) => `Top tags: ${tags}`,
    mood: (average, label, entries) => `Average mood: ${average} out of 5 (${label}), from ${entries} with a mood.`,
    moodLevels: ['Very low', 'Low', 'Okay', 'Good', 'Very good'],
    memoryHeading: (monthOfYear) => `A memory from ${monthOfYear}`,
    review: (year) => `See your ${year} in review`,
    footer:
      'You receive this email because you turned on the monthly recap email in your Thoughty profile. ' +
      'Change the hour or the diary there.',
  },
  fr: {
    subject: (month) => `Votre mois dans votre journal : ${month}`,
    intro: (month) => `Un regard sur ce que vous avez écrit en ${month}.`,
    quiet: (month) => `Vous n’avez pas écrit en ${month}. Voici plutôt un souvenir d’une année passée.`,
    numbersHeading: 'Votre mois en chiffres',
    entries: (count, value) => `${count} ${value < 2 ? 'entrée' : 'entrées'}`,
    words: (count, value) => `${count} ${value < 2 ? 'mot' : 'mots'}`,
    writingDays: (count, value) => `${count} ${value < 2 ? 'jour' : 'jours'} d’écriture`,
    topTags: (tags) => `Tags populaires : ${tags}`,
    mood: (average, label, entries) => `Humeur moyenne : ${average} sur 5 (${label}), sur ${entries} avec une humeur.`,
    moodLevels: ['Très basse', 'Basse', 'Moyenne', 'Bonne', 'Très bonne'],
    memoryHeading: (monthOfYear) => `Un souvenir ${frenchOf(monthOfYear)}`,
    review: (year) => `Voir votre année ${year}`,
    footer:
      'Vous recevez cet e-mail car vous avez activé le bilan mensuel par e-mail dans votre profil Thoughty. ' +
      'Vous pouvez y changer l’heure ou le journal.',
  },
};

export interface MonthlyRecapEmailInput {
  language: EmailLanguage;
  recap: MonthlyRecap;
  frontendUrl: string;
  unsubscribeUrl: string;
  /** The one-click (RFC 8058) unsubscribe address that mail apps post to. */
  oneClickUnsubscribeUrl: string;
}

function formatMonth(year: number, month: number, language: EmailLanguage): string {
  return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** The recap's lines about the month itself: counts, top tags and recorded mood, none for a month without writing. */
function numberLines(recap: MonthlyRecap, copy: RecapCopy, language: EmailLanguage): string[] {
  if (recap.entries === 0) {
    return [];
  }
  const count = (value: number) => new Intl.NumberFormat(language).format(value);
  const lines = [
    copy.entries(count(recap.entries), recap.entries),
    copy.words(count(recap.words), recap.words),
    copy.writingDays(count(recap.writingDays), recap.writingDays),
  ];
  if (recap.topTags.length > 0) {
    lines.push(copy.topTags(recap.topTags.map(({ tag, count: uses }) => `#${tag} (${count(uses)})`).join(', ')));
  }
  if (recap.mood) {
    const average = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(recap.mood.average);
    const label = copy.moodLevels[Math.min(4, Math.max(0, Math.round(recap.mood.average) - 1))];
    lines.push(copy.mood(average, label, copy.entries(count(recap.mood.entries), recap.mood.entries)));
  }
  return lines;
}

/**
 * The monthly recap: how much the writer wrote in the month just ended (entries, words, writing days, top
 * tags, and the moods they recorded, without AI), one memory of that calendar month from an earlier year
 * (its title, at most 200 characters of plain text and a permalink), and a link to the year in review.
 */
export function buildMonthlyRecapEmail(input: MonthlyRecapEmailInput): RenderedEmail {
  const { recap, language } = input;
  const copy = COPY[language];
  const month = formatMonth(recap.year, recap.month, language);
  const lines = numberLines(recap, copy, language);
  const memory = recap.memory ? buildEntryCard(recap.memory, language, input.frontendUrl) : null;
  const memoryHeading = recap.memory
    ? copy.memoryHeading(formatMonth(Number(recap.memory.entry.date.slice(0, 4)), recap.month, language))
    : '';
  const reviewUrl = new URL('/review', input.frontendUrl);
  reviewUrl.searchParams.set('year', String(recap.year));
  if (recap.diaryId !== null) {
    reviewUrl.searchParams.set('diary', String(recap.diaryId));
  }
  const reviewLabel = copy.review(recap.year);

  const frame = {
    heading: capitalize(month),
    intro: recap.entries > 0 ? copy.intro(month) : copy.quiet(month),
    footer: copy.footer,
    unsubscribeLabel: COMMON_EMAIL_COPY[language].unsubscribe,
    unsubscribeUrl: input.unsubscribeUrl,
  };
  const heading2 = (text: string) => `<h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 8px;">${escapeHtml(text)}</h2>`;
  const numbersHtml = lines.length
    ? `
      <section style="border-top: 1px solid #ddd; padding: 16px 0;">
        ${heading2(copy.numbersHeading)}
        <ul style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0; padding-left: 20px;">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      </section>`
    : '';
  const memoryHtml = memory
    ? `
      <section style="border-top: 1px solid #ddd; padding: 16px 0 0;">
        ${heading2(memoryHeading)}${renderEntryCardHtml(memory, 3)}
      </section>`
    : '';
  const reviewHtml = `
      <p style="border-top: 1px solid #ddd; font-size: 16px; margin: 0; padding: 16px 0;"><a href="${escapeHtml(reviewUrl.toString())}" style="color: #4338ca; text-decoration: underline;">${escapeHtml(reviewLabel)}</a></p>`;

  const sections = [
    ...(lines.length ? [[copy.numbersHeading, ...lines.map((line) => `- ${line}`)].join('\n')] : []),
    ...(memory ? [`${memoryHeading}\n\n${entryCardText(memory)}`] : []),
    `${reviewLabel}: ${reviewUrl.toString()}`,
  ];

  const subject = copy.subject(month);
  return {
    subject,
    html: renderEmailDocument({ ...frame, language, subject, bodyHtml: numbersHtml + memoryHtml + reviewHtml }),
    text: renderEmailText(frame, sections),
    headers: oneClickUnsubscribeHeaders(input.oneClickUnsubscribeUrl),
  };
}
