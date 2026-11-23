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
import {
  emailHeading2Html,
  linesSectionText,
  quietSummaryLines,
  renderLinesSectionHtml,
  renderLinkParagraphHtml,
  summaryCountLines,
  summaryTagAndMoodLines,
  yearReviewUrl,
} from '@/modules/opt-in-email/writing-summary-lines';
import type { MonthlyRecap } from './monthly-recap.service';

interface RecapCopy {
  subject: (month: string) => string;
  intro: (month: string) => string;
  quiet: (month: string) => string;
  numbersHeading: string;
  /** The heading in quiet mode, which leaves out every count. */
  quietHeading: string;
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
    quietHeading: 'Your month',
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
    quietHeading: 'Votre mois',
    memoryHeading: (monthOfYear) => `Un souvenir ${frenchOf(monthOfYear)}`,
    review: (year) => `Voir votre année ${year}`,
    footer:
      'Vous recevez cet e-mail car vous avez activé le bilan mensuel par e-mail dans votre profil Thoughty. ' +
      'Vous pouvez y changer l’heure ou le journal.',
  },
};

export interface MonthlyRecapEmailInput {
  language: EmailLanguage;
  /** Quiet mode: the month's tags and mood without any count. */
  quietMode?: boolean;
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

/**
 * The monthly recap: how much the writer wrote in the month just ended (entries, words, writing days, top
 * tags, and the moods they recorded, without AI), one memory of that calendar month from an earlier year
 * (its title, at most 200 characters of plain text and a permalink), and a link to the year in review.
 * In quiet mode the month is told without numbers: only its top tags by name and its mood in words.
 */
export function buildMonthlyRecapEmail(input: MonthlyRecapEmailInput): RenderedEmail {
  const { recap, language } = input;
  const copy = COPY[language];
  const month = formatMonth(recap.year, recap.month, language);
  const lines = input.quietMode
    ? quietSummaryLines(recap, language)
    : [...summaryCountLines(recap, language), ...summaryTagAndMoodLines(recap, language)];
  const linesHeading = input.quietMode ? copy.quietHeading : copy.numbersHeading;
  const memory = recap.memory ? buildEntryCard(recap.memory, language, input.frontendUrl) : null;
  const memoryHeading = recap.memory
    ? copy.memoryHeading(formatMonth(Number(recap.memory.entry.date.slice(0, 4)), recap.month, language))
    : '';
  const reviewUrl = yearReviewUrl(input.frontendUrl, recap.year, recap.diaryId);
  const reviewLabel = copy.review(recap.year);

  const frame = {
    heading: capitalize(month),
    intro: recap.entries > 0 ? copy.intro(month) : copy.quiet(month),
    footer: copy.footer,
    unsubscribeLabel: COMMON_EMAIL_COPY[language].unsubscribe,
    unsubscribeUrl: input.unsubscribeUrl,
  };
  const numbersHtml = renderLinesSectionHtml(linesHeading, lines);
  const memoryHtml = memory
    ? `
      <section style="border-top: 1px solid #ddd; padding: 16px 0 0;">
        ${emailHeading2Html(memoryHeading)}${renderEntryCardHtml(memory, 3)}
      </section>`
    : '';
  const reviewHtml = renderLinkParagraphHtml(reviewLabel, reviewUrl);

  const sections = [
    ...linesSectionText(linesHeading, lines),
    ...(memory ? [`${memoryHeading}\n\n${entryCardText(memory)}`] : []),
    `${reviewLabel}: ${reviewUrl}`,
  ];

  const subject = copy.subject(month);
  return {
    subject,
    html: renderEmailDocument({ ...frame, language, subject, bodyHtml: numbersHtml + memoryHtml + reviewHtml }),
    text: renderEmailText(frame, sections),
    headers: oneClickUnsubscribeHeaders(input.oneClickUnsubscribeUrl),
  };
}
