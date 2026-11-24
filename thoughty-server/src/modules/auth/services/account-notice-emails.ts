import { escapeHtml } from '@/common/utils';
import { resolveEmailLanguage, type EmailLanguage } from '@/modules/opt-in-email/opt-in-email-layout';
import { accountEmailParagraph, renderAccountEmailHtml } from './account-link-emails';
import type { RenderedEmail } from './email.service';

/** What a two-factor code confirms: a sign-in, turning two-factor sign-in on, or a change to the PIN. */
export type TwoFactorCodePurpose = 'login' | 'enable' | 'content-pin';

interface TwoFactorCodeCopy {
  subject: string;
  heading: string;
  codeIs: (code: string) => string;
  purpose: Record<TwoFactorCodePurpose, string>;
  expires: (minutes: number) => string;
  note: string;
}

const TWO_FACTOR_COPY: Record<EmailLanguage, TwoFactorCodeCopy> = {
  en: {
    subject: 'Your Thoughty security code',
    heading: 'Your security code',
    codeIs: (code) => `Your Thoughty security code is ${code}.`,
    purpose: {
      login: 'Use this code to finish signing in to Thoughty.',
      enable: 'Use this code to turn on two-factor authentication for your Thoughty account.',
      'content-pin': 'Use this code to confirm the change to your Thoughty PIN.',
    },
    expires: (minutes) =>
      `This code expires in ${minutes === 1 ? '1 minute' : `${minutes} minutes`} and can be used once.`,
    note: 'If you did not ask for this code, change your password.',
  },
  fr: {
    subject: 'Votre code de sécurité Thoughty',
    heading: 'Votre code de sécurité',
    codeIs: (code) => `Votre code de sécurité Thoughty est ${code}.`,
    purpose: {
      login: 'Utilisez ce code pour terminer votre connexion à Thoughty.',
      enable: 'Utilisez ce code pour activer la double authentification de votre compte Thoughty.',
      'content-pin': 'Utilisez ce code pour confirmer la modification de votre code PIN Thoughty.',
    },
    expires: (minutes) =>
      `Ce code expire dans ${minutes === 1 ? '1 minute' : `${minutes} minutes`} et ne sert qu’une fois.`,
    note: 'Si vous n’avez pas demandé ce code, changez votre mot de passe.',
  },
};

/** The code that confirms `purpose`, in `language` (`en` or `fr`, English for anything else). */
export function renderTwoFactorCodeEmail(
  code: string,
  expiresInMinutes: number,
  purpose: TwoFactorCodePurpose,
  language: string | undefined,
): RenderedEmail {
  const lang = resolveEmailLanguage(language);
  const copy = TWO_FACTOR_COPY[lang];
  const expires = copy.expires(expiresInMinutes);
  return {
    subject: copy.subject,
    html: renderAccountEmailHtml(
      lang,
      copy.heading,
      [
        accountEmailParagraph(copy.purpose[purpose]),
        `\n          <p style="color: #111; font-size: 32px; font-weight: 700; letter-spacing: 8px;">${escapeHtml(code)}</p>`,
        accountEmailParagraph(expires, 'color: #666; font-size: 14px;'),
        accountEmailParagraph(copy.note, 'color: #999; font-size: 14px;'),
      ].join(''),
    ),
    text: [copy.codeIs(code), '', copy.purpose[purpose], expires, '', copy.note, ''].join('\n'),
  };
}

interface AccountDeletionCopy {
  subject: string;
  heading: string;
  paragraphs: string[];
  note: string;
}

const DELETION_COPY: Record<EmailLanguage, AccountDeletionCopy> = {
  en: {
    subject: 'Your Thoughty account is deleted',
    heading: 'Your account is deleted',
    paragraphs: [
      'Your Thoughty account was deleted, as you asked.',
      'You can no longer sign in to it. Your journal and everything stored with your account will be permanently erased within 30 days.',
      'If you did not ask for this, or think it is a mistake, write to us at once from the Contact page of Thoughty.',
    ],
    note: 'We are sorry to see you go. Thank you for using Thoughty.',
  },
  fr: {
    subject: 'Votre compte Thoughty est supprimé',
    heading: 'Votre compte est supprimé',
    paragraphs: [
      'Votre compte Thoughty a été supprimé, comme vous l’avez demandé.',
      'Vous ne pouvez plus vous y connecter. Votre journal et tout ce qui est enregistré avec votre compte seront définitivement effacés sous 30 jours.',
      'Si vous n’avez rien demandé, ou pensez qu’il s’agit d’une erreur, écrivez-nous sans attendre depuis la page Contact de Thoughty.',
    ],
    note: 'Nous sommes désolés de vous voir partir. Merci d’avoir utilisé Thoughty.',
  },
};

/** The confirmation that the account is deleted, in `language` (`en` or `fr`, English for anything else). */
export function renderAccountDeletionEmail(language: string | undefined): RenderedEmail {
  const lang = resolveEmailLanguage(language);
  const copy = DELETION_COPY[lang];
  return {
    subject: copy.subject,
    html: renderAccountEmailHtml(
      lang,
      copy.heading,
      `${copy.paragraphs.map((paragraph) => accountEmailParagraph(paragraph)).join('')}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">${accountEmailParagraph(copy.note, 'color: #999; font-size: 14px;')}`,
    ),
    text: [copy.subject, '', ...copy.paragraphs, '', copy.note, ''].join('\n'),
  };
}
