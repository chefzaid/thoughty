import { escapeHtml } from '@/common/utils';
import type { RenderedEmail } from '@/modules/auth/services/email.service';
import {
  COMMON_EMAIL_COPY,
  type EmailLanguage,
  oneClickUnsubscribeHeaders,
  renderEmailDocument,
  renderEmailText,
} from '@/modules/opt-in-email/opt-in-email-layout';

/** What a writing reminder says beyond its fixed words: the diary it opens on, and the streak writing today keeps. */
export interface WritingReminder {
  /** The diary the reminder watches and opens the journal on; null for all diaries. */
  diaryId: number | null;
  /** Days in a row with an entry up to yesterday, which an entry today carries on; 0 for none. */
  currentStreak: number;
}

interface ReminderCopy {
  subject: string;
  heading: string;
  intro: string;
  /** `count` is already formatted in the writer's language. */
  streak: (count: string, value: number) => string;
  write: string;
  cards: (draw: string) => string;
  /** The composer's own button, as the app names it. */
  drawCard: string;
  footer: string;
}

const COPY: Record<EmailLanguage, ReminderCopy> = {
  en: {
    subject: 'A few lines for your journal today?',
    heading: 'Time to write',
    intro: 'You haven’t written today yet. A few lines are enough: something that happened, something on your mind, or one thing you noticed.',
    streak: (count, value) => `You have written ${count} ${value === 1 ? 'day' : 'days'} in a row. An entry today keeps it going.`,
    write: 'Write today’s entry',
    cards: (draw) => `Need a question to start? Choose “${draw}” in the composer.`,
    drawCard: 'Draw a card',
    footer:
      'You receive this email because you turned on the writing reminder in your Thoughty profile. ' +
      'It never comes on a day you have already written. Change the hour or the diary there.',
  },
  fr: {
    subject: 'Quelques lignes pour votre journal aujourd’hui ?',
    heading: 'Un moment pour écrire',
    intro: 'Vous n’avez pas encore écrit aujourd’hui. Quelques lignes suffisent : un événement, une pensée qui vous occupe, ou une chose que vous avez remarquée.',
    streak: (count, value) => `Vous avez écrit ${count} ${value < 2 ? 'jour' : 'jours'} d’affilée. Une entrée aujourd’hui prolonge la série.`,
    write: 'Écrire l’entrée du jour',
    cards: (draw) => `Besoin d’une question pour commencer ? Choisissez « ${draw} » dans l’éditeur.`,
    drawCard: 'Tirer une carte',
    footer:
      'Vous recevez cet e-mail car vous avez activé le rappel d’écriture dans votre profil Thoughty. ' +
      'Il n’arrive jamais un jour où vous avez déjà écrit. Vous pouvez y changer l’heure ou le journal.',
  },
};

export interface WritingReminderEmailInput {
  language: EmailLanguage;
  /** Quiet mode: no streak count. */
  quietMode?: boolean;
  reminder: WritingReminder;
  frontendUrl: string;
  unsubscribeUrl: string;
  /** The one-click (RFC 8058) unsubscribe address that mail apps post to. */
  oneClickUnsubscribeUrl: string;
}

/**
 * The writing reminder: a short nudge to write today, the streak an entry today would carry on (left out
 * in quiet mode and when there is none), a link that opens the journal's composer on the reminder's diary,
 * and a pointer to the prompt cards. It holds nothing from the journal itself.
 */
export function buildWritingReminderEmail(input: WritingReminderEmailInput): RenderedEmail {
  const { reminder, language } = input;
  const copy = COPY[language];
  const writeUrl = new URL('/journal', input.frontendUrl);
  if (reminder.diaryId !== null) {
    writeUrl.searchParams.set('diary', String(reminder.diaryId));
  }
  const streak =
    !input.quietMode && reminder.currentStreak > 0
      ? copy.streak(new Intl.NumberFormat(language).format(reminder.currentStreak), reminder.currentStreak)
      : null;
  const cards = copy.cards(copy.drawCard);

  const frame = {
    heading: copy.heading,
    intro: copy.intro,
    footer: copy.footer,
    unsubscribeLabel: COMMON_EMAIL_COPY[language].unsubscribe,
    unsubscribeUrl: input.unsubscribeUrl,
  };
  const paragraph = (text: string) => `
      <p style="color: #1a1a1a; font-size: 16px; line-height: 1.5; margin: 0 0 16px;">${escapeHtml(text)}</p>`;
  const bodyHtml = `${streak ? paragraph(streak) : ''}
      <p style="margin: 0 0 16px;"><a href="${escapeHtml(writeUrl.toString())}" style="background-color: #4338ca; border-radius: 6px; color: #ffffff; display: inline-block; font-size: 16px; padding: 10px 18px; text-decoration: none;">${escapeHtml(copy.write)}</a></p>${paragraph(cards)}`;

  return {
    subject: copy.subject,
    html: renderEmailDocument({ ...frame, language, subject: copy.subject, bodyHtml }),
    text: renderEmailText(frame, [...(streak ? [streak] : []), `${copy.write}: ${writeUrl.toString()}`, cards]),
    headers: oneClickUnsubscribeHeaders(input.oneClickUnsubscribeUrl),
  };
}
