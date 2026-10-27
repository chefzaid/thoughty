import type { RenderedEmail } from '@/modules/auth/services/email.service';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import { localDateIn } from '@/common/utils/time-zone.util';
import {
  COMMON_EMAIL_COPY,
  type EmailEntryCard,
  type EmailLanguage,
  ENTRY_EXCERPT_LENGTH,
  entryCardText,
  formatLocalDay,
  renderEmailDocument,
  renderEmailText,
  renderEntryCardHtml,
} from '@/modules/opt-in-email/opt-in-email-layout';

interface EmailCopy {
  subject: string;
  heading: string;
  intro: (sealedOn: string) => string;
  written: (date: string) => string;
  footer: string;
}

const COPY: Record<EmailLanguage, EmailCopy> = {
  en: {
    subject: 'Your time capsule has opened',
    heading: 'Your time capsule is open',
    intro: (sealedOn) => `On ${sealedOn}, you sealed an entry until today. Here it is.`,
    written: (date) => `Written on ${date}`,
    footer:
      'You receive this email because you sealed this entry as a time capsule in Thoughty. ' +
      'It is the only email the capsule sends.',
  },
  fr: {
    subject: 'Votre capsule temporelle s’est ouverte',
    heading: 'Votre capsule temporelle est ouverte',
    intro: (sealedOn) => `Le ${sealedOn}, vous avez scellé une entrée jusqu’à aujourd’hui. La voici.`,
    written: (date) => `Écrite le ${date}`,
    footer:
      'Vous recevez cet e-mail car vous avez scellé cette entrée comme capsule temporelle dans Thoughty. ' +
      'C’est le seul e-mail que la capsule envoie.',
  },
};

export interface TimeCapsuleEmailInput {
  language: EmailLanguage;
  entry: { id: number; date: string; title: string | null; content: string };
  /** When it was sealed, and the zone it was sealed in, for the day the email names. */
  sealedAt: Date;
  timeZone: string;
  frontendUrl: string;
}

/**
 * The email a time capsule sends when it opens on schedule: when it was sealed and written, its title,
 * at most the first 200 characters of its text as plain text, and its permalink in the journal. Nothing
 * more of the entry leaves the app. It is a one-off the writer scheduled, so it has no unsubscribe link.
 */
export function buildTimeCapsuleEmail(input: TimeCapsuleEmailInput): RenderedEmail {
  const copy = COPY[input.language];
  const common = COMMON_EMAIL_COPY[input.language];
  const url = new URL('/journal', input.frontendUrl);
  url.searchParams.set('entry', String(input.entry.id));
  const label = input.entry.title?.trim() || common.untitled;
  const card: EmailEntryCard = {
    when: copy.written(formatLocalDay(input.entry.date.slice(0, 10), input.language, true)),
    label,
    excerpt: plainExcerpt(input.entry.content, ENTRY_EXCERPT_LENGTH),
    url: url.toString(),
    openLabel: common.open(label),
  };
  const frame = {
    heading: copy.heading,
    intro: copy.intro(formatLocalDay(localDateIn(input.sealedAt, input.timeZone), input.language, true)),
    footer: copy.footer,
  };

  return {
    subject: copy.subject,
    html: renderEmailDocument({
      ...frame,
      language: input.language,
      subject: copy.subject,
      bodyHtml: renderEntryCardHtml(card),
    }),
    text: renderEmailText(frame, [entryCardText(card)]),
  };
}
