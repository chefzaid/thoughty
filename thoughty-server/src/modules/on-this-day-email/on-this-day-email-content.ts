import type { RenderedEmail } from '@/modules/auth/services/email.service';
import type { OnThisDayEntry } from '@/modules/entries';
import {
  buildEntryCard,
  COMMON_EMAIL_COPY,
  type EmailLanguage,
  ENTRY_EXCERPT_LENGTH,
  entryCardText,
  formatLocalDay,
  oneClickUnsubscribeHeaders,
  renderEmailDocument,
  renderEmailText,
  renderEntryCardHtml,
  resolveEmailLanguage,
} from '@/modules/opt-in-email/opt-in-email-layout';

export type OnThisDayLanguage = EmailLanguage;
export const resolveOnThisDayLanguage = resolveEmailLanguage;

/** Characters of an entry's text the email shows at most, after its title. */
export const ON_THIS_DAY_EXCERPT_LENGTH = ENTRY_EXCERPT_LENGTH;

interface EmailCopy {
  subject: string;
  heading: string;
  intro: (date: string) => string;
  footer: string;
}

const COPY: Record<OnThisDayLanguage, EmailCopy> = {
  en: {
    subject: 'On this day in your journal',
    heading: 'On this day',
    intro: (date) => `What you wrote on ${date} in years past.`,
    footer:
      'You receive this email because you turned on “On this day” emails in your Thoughty profile. ' +
      'Change the hour or the diary there.',
  },
  fr: {
    subject: 'Ce jour-là dans votre journal',
    heading: 'Ce jour-là',
    intro: (date) => `Ce que vous avez écrit un ${date}, les années passées.`,
    footer:
      'Vous recevez cet e-mail car vous avez activé les e-mails « Ce jour-là » dans votre profil Thoughty. ' +
      'Vous pouvez y changer l’heure ou le journal.',
  },
};

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

/**
 * The "On this day" email: for each past entry its title, at most the first 200 characters of its text
 * as plain text, how long ago it was written, and a link to open it in the journal. Nothing more of the
 * entry leaves the app. The footer says why it arrives and links to a one-click unsubscribe.
 */
export function buildOnThisDayEmail(input: OnThisDayEmailInput): RenderedEmail {
  const copy = COPY[input.language];
  const cards = input.entries.map((entry) => buildEntryCard(entry, input.language, input.frontendUrl));
  const frame = {
    heading: copy.heading,
    intro: copy.intro(formatLocalDay(input.localDate, input.language, false)),
    footer: copy.footer,
    unsubscribeLabel: COMMON_EMAIL_COPY[input.language].unsubscribe,
    unsubscribeUrl: input.unsubscribeUrl,
  };

  return {
    subject: copy.subject,
    html: renderEmailDocument({
      ...frame,
      language: input.language,
      subject: copy.subject,
      bodyHtml: cards.map((card) => renderEntryCardHtml(card)).join(''),
    }),
    text: renderEmailText(frame, cards.map(entryCardText)),
    headers: oneClickUnsubscribeHeaders(input.oneClickUnsubscribeUrl),
  };
}
