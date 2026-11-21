import { escapeHtml } from '@/common/utils';
import type { RenderedEmail } from '../services/email.service';
import type { ClientSoftware } from './client-software';
import {
  renderEmailDocument,
  renderEmailText,
  resolveEmailLanguage,
  type EmailLanguage,
} from '@/modules/opt-in-email/opt-in-email-layout';

interface NewSignInCopy {
  subject: string;
  heading: string;
  intro: (where: string, when: string) => string;
  unknownBrowser: string;
  unknownSystem: string;
  on: (browser: string, system: string) => string;
  advice: string;
  review: string;
  footer: string;
}

const COPY: Record<EmailLanguage, NewSignInCopy> = {
  en: {
    subject: 'New sign-in to your Thoughty account',
    heading: 'A new browser signed in',
    intro: (where, when) => `Your Thoughty account was signed in from ${where}, which it had not used before, on ${when}.`,
    unknownBrowser: 'an unknown browser',
    unknownSystem: 'an unknown system',
    on: (browser, system) => `${browser} on ${system}`,
    advice:
      'If it was you, there is nothing to do. If not, change your password and sign out the other sessions in Profile › Privacy, where the account activity lists every sign-in.',
    review: 'Review account activity',
    footer: 'You get this email because new-browser sign-in alerts are on. Turn them off in Profile › Privacy.',
  },
  fr: {
    subject: 'Nouvelle connexion à votre compte Thoughty',
    heading: 'Un nouveau navigateur s’est connecté',
    intro: (where, when) => `Votre compte Thoughty a été ouvert depuis ${where}, jamais utilisé auparavant, le ${when}.`,
    unknownBrowser: 'un navigateur inconnu',
    unknownSystem: 'un système inconnu',
    on: (browser, system) => `${browser} sous ${system}`,
    advice:
      'Si c’était vous, il n’y a rien à faire. Sinon, changez votre mot de passe et déconnectez les autres sessions dans Profil › Confidentialité, où l’activité du compte liste chaque connexion.',
    review: 'Voir l’activité du compte',
    footer: 'Vous recevez cet e-mail car les alertes de connexion depuis un nouveau navigateur sont activées. Désactivez-les dans Profil › Confidentialité.',
  },
};

export interface NewSignInEmailInput {
  language: string | undefined;
  software: ClientSoftware;
  signedInAt: Date;
  frontendUrl: string;
}

/** The time of the sign-in, in UTC, as the email's language writes it. */
function formatSignInTime(signedInAt: Date, language: EmailLanguage): string {
  return `${new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(signedInAt)} UTC`;
}

/**
 * The email sent when an account signs in from a browser and system it has not signed in from in the
 * past year: which ones and when, and where to review it. It never holds anything of the journal.
 */
export function renderNewSignInEmail({ language, software, signedInAt, frontendUrl }: NewSignInEmailInput): RenderedEmail {
  const lang = resolveEmailLanguage(language);
  const copy = COPY[lang];
  const where = copy.on(software.browser ?? copy.unknownBrowser, software.system ?? copy.unknownSystem);
  const reviewUrl = new URL('/profile', frontendUrl).toString();
  const document = {
    heading: copy.heading,
    intro: copy.intro(where, formatSignInTime(signedInAt, lang)),
    footer: copy.footer,
  };
  const bodyHtml = `
      <p style="color: #1a1a1a; font-size: 16px; line-height: 1.5;">${escapeHtml(copy.advice)}</p>
      <p style="margin: 24px 0;"><a href="${escapeHtml(reviewUrl)}" style="color: #4338ca; font-size: 16px; text-decoration: underline;">${escapeHtml(copy.review)}</a></p>`;
  return {
    subject: copy.subject,
    html: renderEmailDocument({ ...document, language: lang, subject: copy.subject, bodyHtml }),
    text: renderEmailText(document, [copy.advice, `${copy.review}: ${reviewUrl}`]),
  };
}
