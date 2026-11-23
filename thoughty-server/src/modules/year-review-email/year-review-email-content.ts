import type { RenderedEmail } from '@/modules/auth/services/email.service';
import {
  COMMON_EMAIL_COPY,
  type EmailLanguage,
  oneClickUnsubscribeHeaders,
  renderEmailDocument,
  renderEmailText,
} from '@/modules/opt-in-email/opt-in-email-layout';
import {
  countEntries,
  formatCount,
  linesSectionText,
  type Plural,
  quietSummaryLines,
  renderLinesSectionHtml,
  renderLinkParagraphHtml,
  summaryCountLines,
  summaryTagAndMoodLines,
  yearReviewUrl,
} from '@/modules/opt-in-email/writing-summary-lines';
import type { YearRecap } from './year-recap.service';

interface YearCopy {
  subject: (year: number) => string;
  heading: (year: number) => string;
  intro: (year: number) => string;
  numbersHeading: string;
  /** The heading in quiet mode, which leaves out every count. */
  quietHeading: string;
  longestStreak: Plural;
  /** `entries` is already counted, as "14 entries". */
  busiestMonth: (month: string, entries: string) => string;
  review: (year: number) => string;
  footer: string;
}

const COPY: Record<EmailLanguage, YearCopy> = {
  en: {
    subject: (year) => `Your ${year} in your journal`,
    heading: (year) => `Your ${year} in review`,
    intro: (year) => `A look back at what you wrote in ${year}.`,
    numbersHeading: 'Your year in numbers',
    quietHeading: 'Your year',
    longestStreak: (count, value) => `Longest streak: ${count} ${value === 1 ? 'day' : 'days'} in a row`,
    busiestMonth: (month, entries) => `Busiest month: ${month}, with ${entries}`,
    review: (year) => `Open your ${year} in review`,
    footer:
      'You receive this email because you turned on the year in review email in your Thoughty profile. ' +
      'Change the hour or the diary there.',
  },
  fr: {
    subject: (year) => `Votre année ${year} dans votre journal`,
    heading: (year) => `Votre bilan ${year}`,
    intro: (year) => `Un regard sur ce que vous avez écrit en ${year}.`,
    numbersHeading: 'Votre année en chiffres',
    quietHeading: 'Votre année',
    longestStreak: (count, value) => `Plus longue série : ${count} ${value < 2 ? 'jour' : 'jours'} d’affilée`,
    busiestMonth: (month, entries) => `Mois le plus actif : ${month}, avec ${entries}`,
    review: (year) => `Ouvrir votre bilan ${year}`,
    footer:
      'Vous recevez cet e-mail car vous avez activé le bilan de l’année par e-mail dans votre profil Thoughty. ' +
      'Vous pouvez y changer l’heure ou le journal.',
  },
};

export interface YearReviewEmailInput {
  language: EmailLanguage;
  /** Quiet mode: the year's tags and mood without any count. */
  quietMode?: boolean;
  recap: YearRecap;
  frontendUrl: string;
  unsubscribeUrl: string;
  /** The one-click (RFC 8058) unsubscribe address that mail apps post to. */
  oneClickUnsubscribeUrl: string;
}

function formatMonthName(month: number, language: EmailLanguage): string {
  return new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)));
}

/** The year's own lines beside the counts every recap has: its longest streak and its busiest month. */
function yearLines(recap: YearRecap, copy: YearCopy, language: EmailLanguage): string[] {
  return [
    copy.longestStreak(formatCount(recap.longestStreak, language), recap.longestStreak),
    copy.busiestMonth(formatMonthName(recap.busiestMonth.month, language), countEntries(recap.busiestMonth.entries, language)),
  ];
}

/**
 * The year in review email: how much the writer wrote in the year just ended (entries, words, writing days,
 * longest streak, busiest month, top tags, and the moods they recorded, without AI) and a link to that
 * year's review. It holds no text from any entry. In quiet mode the year is told without numbers: only its
 * top tags by name and its mood in words.
 */
export function buildYearReviewEmail(input: YearReviewEmailInput): RenderedEmail {
  const { recap, language } = input;
  const copy = COPY[language];
  const lines = input.quietMode
    ? quietSummaryLines(recap, language)
    : [...summaryCountLines(recap, language), ...yearLines(recap, copy, language), ...summaryTagAndMoodLines(recap, language)];
  const linesHeading = input.quietMode ? copy.quietHeading : copy.numbersHeading;
  const reviewUrl = yearReviewUrl(input.frontendUrl, recap.year, recap.diaryId);
  const reviewLabel = copy.review(recap.year);

  const frame = {
    heading: copy.heading(recap.year),
    intro: copy.intro(recap.year),
    footer: copy.footer,
    unsubscribeLabel: COMMON_EMAIL_COPY[language].unsubscribe,
    unsubscribeUrl: input.unsubscribeUrl,
  };
  const bodyHtml = renderLinesSectionHtml(linesHeading, lines) + renderLinkParagraphHtml(reviewLabel, reviewUrl);
  const sections = [...linesSectionText(linesHeading, lines), `${reviewLabel}: ${reviewUrl}`];

  const subject = copy.subject(recap.year);
  return {
    subject,
    html: renderEmailDocument({ ...frame, language, subject, bodyHtml }),
    text: renderEmailText(frame, sections),
    headers: oneClickUnsubscribeHeaders(input.oneClickUnsubscribeUrl),
  };
}
