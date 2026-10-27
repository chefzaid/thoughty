import { escapeHtml } from '@/common/utils';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import type { OnThisDayEntry } from '@/modules/entries';

/** The languages opt-in emails are written in: the writer's app language, English for anything else. */
export type EmailLanguage = 'en' | 'fr';

export function resolveEmailLanguage(language: string | undefined): EmailLanguage {
  return language === 'fr' ? 'fr' : 'en';
}

/** A local day (YYYY-MM-DD) as the email's language writes it, with or without its year. */
export function formatLocalDay(localDate: string, language: EmailLanguage, withYear: boolean): string {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T00:00:00Z`));
}

/** The RFC 8058 headers that let mail apps turn the email off in one click. */
export function oneClickUnsubscribeHeaders(oneClickUnsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUnsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/** One entry in an email: when it was written, its title, a short plain excerpt, and a link to open it. */
export interface EmailEntryCard {
  when: string;
  label: string;
  excerpt: string;
  url: string;
  openLabel: string;
}

/** Characters of an entry's text an email shows at most, after its title. */
export const ENTRY_EXCERPT_LENGTH = 200;

interface CommonCopy {
  yearsAgo: (years: number) => string;
  untitled: string;
  open: (label: string) => string;
  unsubscribe: string;
}

/** The words every opt-in email uses the same way. */
export const COMMON_EMAIL_COPY: Record<EmailLanguage, CommonCopy> = {
  en: {
    yearsAgo: (years) => (years === 1 ? '1 year ago' : `${years} years ago`),
    untitled: 'Untitled entry',
    open: (label) => `Open “${label}”`,
    unsubscribe: 'Stop these emails',
  },
  fr: {
    yearsAgo: (years) => (years === 1 ? 'Il y a 1 an' : `Il y a ${years} ans`),
    untitled: 'Entrée sans titre',
    open: (label) => `Ouvrir « ${label} »`,
    unsubscribe: 'Ne plus recevoir ces e-mails',
  },
};

/**
 * A past entry as an email shows it: how long ago and when, its title, at most its first 200 characters
 * as plain text, and its permalink in the journal. Nothing more of the entry leaves the app.
 */
export function buildEntryCard({ entry, yearsAgo }: OnThisDayEntry, language: EmailLanguage, frontendUrl: string): EmailEntryCard {
  const copy = COMMON_EMAIL_COPY[language];
  const url = new URL('/journal', frontendUrl);
  url.searchParams.set('entry', String(entry.id));
  const label = entry.title?.trim() || copy.untitled;
  return {
    label,
    when: `${copy.yearsAgo(yearsAgo)} · ${formatLocalDay(entry.date, language, true)}`,
    excerpt: plainExcerpt(entry.content, ENTRY_EXCERPT_LENGTH),
    url: url.toString(),
    openLabel: copy.open(label),
  };
}

/** The card's lines in the plain-text alternative. */
export function entryCardText(card: EmailEntryCard): string {
  return [card.when, card.label, card.excerpt, card.url].filter(Boolean).join('\n');
}

/** The card as HTML; its title is a level-2 heading unless it sits under one. */
export function renderEntryCardHtml(card: EmailEntryCard, headingLevel: 2 | 3 = 2): string {
  return `
          <article style="border-top: 1px solid #ddd; padding: 16px 0;">
            <p style="color: #4a4a4a; font-size: 14px; margin: 0 0 4px;">${escapeHtml(card.when)}</p>
            <h${headingLevel} style="color: #1a1a1a; font-size: 18px; margin: 0 0 8px;">${escapeHtml(card.label)}</h${headingLevel}>
            ${card.excerpt ? `<p style="color: #1a1a1a; font-size: 16px; line-height: 1.5; margin: 0 0 12px;">${escapeHtml(card.excerpt)}</p>` : ''}
            <a href="${escapeHtml(card.url)}" style="color: #4338ca; font-size: 16px; text-decoration: underline;">${escapeHtml(card.openLabel)}</a>
          </article>`;
}

export interface EmailDocument {
  language: EmailLanguage;
  subject: string;
  heading: string;
  intro: string;
  /** The email's own sections, already escaped HTML. */
  bodyHtml: string;
  /** Why the email arrives. */
  footer: string;
  /** Opt-in emails link to turning them off; a one-off email the writer scheduled (a time capsule) has nothing to turn off. */
  unsubscribeLabel?: string;
  unsubscribeUrl?: string;
}

function unsubscribeLinkHtml(email: Pick<EmailDocument, 'unsubscribeLabel' | 'unsubscribeUrl'>): string {
  return email.unsubscribeUrl && email.unsubscribeLabel
    ? `
        <p style="font-size: 13px;"><a href="${escapeHtml(email.unsubscribeUrl)}" style="color: #4338ca; text-decoration: underline;">${escapeHtml(email.unsubscribeLabel)}</a></p>`
    : '';
}

/** The accessible HTML page every email about the journal shares: heading, intro, its sections, and the footer with any unsubscribe link. */
export function renderEmailDocument(email: EmailDocument): string {
  return `<!DOCTYPE html>
<html lang="${email.language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(email.subject)}</title>
  </head>
  <body style="margin: 0; background-color: #ffffff;">
    <main style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px;">${escapeHtml(email.heading)}</h1>
      <p style="color: #4a4a4a; font-size: 16px; margin: 0 0 16px;">${escapeHtml(email.intro)}</p>${email.bodyHtml}
      <footer style="border-top: 1px solid #ddd; padding-top: 16px;">
        <p style="color: #4a4a4a; font-size: 13px; line-height: 1.5;">${escapeHtml(email.footer)}</p>${unsubscribeLinkHtml(email)}
      </footer>
    </main>
  </body>
</html>
`;
}

/** The plain-text alternative: the heading, intro and sections as paragraphs, then the footer and any unsubscribe link. */
export function renderEmailText(email: Omit<EmailDocument, 'bodyHtml' | 'language' | 'subject'>, sections: string[]): string {
  return [
    email.heading,
    email.intro,
    ...sections,
    email.footer,
    ...(email.unsubscribeUrl && email.unsubscribeLabel ? [`${email.unsubscribeLabel}: ${email.unsubscribeUrl}`] : []),
  ].join('\n\n') + '\n';
}
