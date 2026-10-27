import { escapeHtml } from '@/common/utils';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import type { RenderedEmail } from '@/modules/auth/services/email.service';
import type { OnThisDayEntry } from '@/modules/entries';

export type OnThisDayLanguage = 'en' | 'fr';

/** Characters of an entry's text the email shows at most, after its title. */
export const ON_THIS_DAY_EXCERPT_LENGTH = 200;

interface EmailCopy {
  subject: string;
  heading: string;
  intro: (date: string) => string;
  yearsAgo: (years: number) => string;
  untitled: string;
  open: (label: string) => string;
  footer: string;
  unsubscribe: string;
}

const COPY: Record<OnThisDayLanguage, EmailCopy> = {
  en: {
    subject: 'On this day in your journal',
    heading: 'On this day',
    intro: (date) => `What you wrote on ${date} in years past.`,
    yearsAgo: (years) => (years === 1 ? '1 year ago' : `${years} years ago`),
    untitled: 'Untitled entry',
    open: (label) => `Open “${label}”`,
    footer:
      'You receive this email because you turned on “On this day” emails in your Thoughty profile. ' +
      'Change the hour or the diary there.',
    unsubscribe: 'Stop these emails',
  },
  fr: {
    subject: 'Ce jour-là dans votre journal',
    heading: 'Ce jour-là',
    intro: (date) => `Ce que vous avez écrit un ${date}, les années passées.`,
    yearsAgo: (years) => (years === 1 ? 'Il y a 1 an' : `Il y a ${years} ans`),
    untitled: 'Entrée sans titre',
    open: (label) => `Ouvrir « ${label} »`,
    footer:
      'Vous recevez cet e-mail car vous avez activé les e-mails « Ce jour-là » dans votre profil Thoughty. ' +
      'Vous pouvez y changer l’heure ou le journal.',
    unsubscribe: 'Ne plus recevoir ces e-mails',
  },
};

export function resolveOnThisDayLanguage(language: string | undefined): OnThisDayLanguage {
  return language === 'fr' ? 'fr' : 'en';
}

export interface OnThisDayEmailInput {
  language: OnThisDayLanguage;
  /** The writer's local day the email is for (YYYY-MM-DD). */
  localDate: string;
  entries: OnThisDayEntry[];
  frontendUrl: string;
  unsubscribeUrl: string;
  /** The one-click (RFC 8058) unsubscribe address that mail apps post to. */
  oneClickUnsubscribeUrl: string;
}

interface EmailItem {
  label: string;
  when: string;
  excerpt: string;
  url: string;
}

function formatDay(localDate: string, language: OnThisDayLanguage, withYear: boolean): string {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T00:00:00Z`));
}

/**
 * The "On this day" email: for each past entry its title, at most the first 200 characters of its text
 * as plain text, how long ago it was written, and a link to open it in the journal. Nothing more of the
 * entry leaves the app. The footer says why it arrives and links to a one-click unsubscribe.
 */
export function buildOnThisDayEmail(input: OnThisDayEmailInput): RenderedEmail {
  const copy = COPY[input.language];
  const items: EmailItem[] = input.entries.map(({ entry, yearsAgo }) => {
    const title = entry.title?.trim() ?? '';
    const url = new URL('/journal', input.frontendUrl);
    url.searchParams.set('entry', String(entry.id));
    return {
      label: title || copy.untitled,
      when: `${copy.yearsAgo(yearsAgo)} · ${formatDay(entry.date, input.language, true)}`,
      excerpt: plainExcerpt(entry.content, ON_THIS_DAY_EXCERPT_LENGTH),
      url: url.toString(),
    };
  });
  const intro = copy.intro(formatDay(input.localDate, input.language, false));

  return {
    subject: copy.subject,
    html: renderHtml(input, copy, intro, items),
    text: renderText(input, copy, intro, items),
    headers: {
      'List-Unsubscribe': `<${input.oneClickUnsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

function renderHtml(input: OnThisDayEmailInput, copy: EmailCopy, intro: string, items: EmailItem[]): string {
  const entries = items
    .map(
      (item) => `
          <article style="border-top: 1px solid #ddd; padding: 16px 0;">
            <p style="color: #4a4a4a; font-size: 14px; margin: 0 0 4px;">${escapeHtml(item.when)}</p>
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 8px;">${escapeHtml(item.label)}</h2>
            ${item.excerpt ? `<p style="color: #1a1a1a; font-size: 16px; line-height: 1.5; margin: 0 0 12px;">${escapeHtml(item.excerpt)}</p>` : ''}
            <a href="${escapeHtml(item.url)}" style="color: #4338ca; font-size: 16px; text-decoration: underline;">${escapeHtml(copy.open(item.label))}</a>
          </article>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${input.language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin: 0; background-color: #ffffff;">
    <main style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px;">${escapeHtml(copy.heading)}</h1>
      <p style="color: #4a4a4a; font-size: 16px; margin: 0 0 16px;">${escapeHtml(intro)}</p>${entries}
      <footer style="border-top: 1px solid #ddd; padding-top: 16px;">
        <p style="color: #4a4a4a; font-size: 13px; line-height: 1.5;">${escapeHtml(copy.footer)}</p>
        <p style="font-size: 13px;"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #4338ca; text-decoration: underline;">${escapeHtml(copy.unsubscribe)}</a></p>
      </footer>
    </main>
  </body>
</html>
`;
}

function renderText(input: OnThisDayEmailInput, copy: EmailCopy, intro: string, items: EmailItem[]): string {
  const entries = items.map((item) =>
    [item.when, item.label, item.excerpt, item.url].filter(Boolean).join('\n'),
  );
  return [
    copy.heading,
    intro,
    ...entries,
    copy.footer,
    `${copy.unsubscribe}: ${input.unsubscribeUrl}`,
  ].join('\n\n') + '\n';
}
