import { escapeHtml } from '@/common/utils';
import { resolveEmailLanguage, type EmailLanguage } from '@/modules/opt-in-email/opt-in-email-layout';
import type { RenderedEmail } from './email.service';

/** The words of an email that asks its reader to open one link. */
interface LinkEmailCopy {
  subject: string;
  heading: string;
  paragraphs: string[];
  action: string;
  note: string;
}

type LinkEmailKind = 'signUpLink' | 'signUpNotice' | 'emailVerification' | 'passwordReset';

/** For the emails whose link carries a token: where to copy it when the button does not work. */
const LINK_FALLBACK: Record<EmailLanguage, string> = {
  en: "If the button doesn't work, copy and paste this link into your browser:",
  fr: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
};

const COPY: Record<EmailLanguage, Record<LinkEmailKind, LinkEmailCopy>> = {
  en: {
    signUpLink: {
      subject: 'Finish creating your Thoughty account',
      heading: 'Finish creating your account',
      paragraphs: [
        'Someone, hopefully you, asked to create a Thoughty account with this email address. Open the link below and enter the password you chose to finish.',
        'This link works once and expires in 24 hours.',
      ],
      action: 'Create my account',
      note: 'If you did not sign up, ignore this email: no account is created without it.',
    },
    signUpNotice: {
      subject: 'Someone tried to sign up to Thoughty with your email',
      heading: 'You already have an account',
      paragraphs: [
        'Someone tried to create a Thoughty account with this email address, which already has one. Nothing was changed.',
        'If it was you, sign in instead. If you forgot your password, choose "Forgot password?" on the sign-in page to reset it.',
      ],
      action: 'Sign in',
      note: 'If it was not you, you can ignore this email.',
    },
    emailVerification: {
      subject: 'Verify your Thoughty email',
      heading: 'Verify your email',
      paragraphs: [
        'Please verify this email address to finish securing your Thoughty account.',
        'This verification link will expire in 24 hours.',
      ],
      action: 'Verify Email',
      note: 'If you did not create a Thoughty account, please ignore this email.',
    },
    passwordReset: {
      subject: 'Reset your Thoughty password',
      heading: 'Reset your password',
      paragraphs: [
        'You asked to reset the password of your Thoughty account. Open the link below to choose a new one.',
        'This link works once and expires in 1 hour.',
      ],
      action: 'Reset my password',
      note: 'If you did not ask for this, ignore this email: your password stays the same.',
    },
  },
  fr: {
    signUpLink: {
      subject: 'Terminez la création de votre compte Thoughty',
      heading: 'Terminez la création de votre compte',
      paragraphs: [
        'Quelqu’un, vous sans doute, a demandé à créer un compte Thoughty avec cette adresse e-mail. Ouvrez le lien ci-dessous et saisissez le mot de passe choisi pour terminer.',
        'Ce lien ne fonctionne qu’une fois et expire dans 24 heures.',
      ],
      action: 'Créer mon compte',
      note: 'Si vous ne vous êtes pas inscrit, ignorez cet e-mail : aucun compte n’est créé sans lui.',
    },
    signUpNotice: {
      subject: 'Quelqu’un a tenté de s’inscrire à Thoughty avec votre adresse e-mail',
      heading: 'Vous avez déjà un compte',
      paragraphs: [
        'Quelqu’un a tenté de créer un compte Thoughty avec cette adresse e-mail, qui en a déjà un. Rien n’a été modifié.',
        'Si c’était vous, connectez-vous plutôt. Si vous avez oublié votre mot de passe, choisissez « Mot de passe oublié ? » sur la page de connexion pour le réinitialiser.',
      ],
      action: 'Se connecter',
      note: 'Si ce n’était pas vous, vous pouvez ignorer cet e-mail.',
    },
    emailVerification: {
      subject: 'Vérifiez votre adresse e-mail Thoughty',
      heading: 'Vérifiez votre adresse e-mail',
      paragraphs: [
        'Vérifiez cette adresse e-mail pour finir de sécuriser votre compte Thoughty.',
        'Ce lien de vérification expire dans 24 heures.',
      ],
      action: 'Vérifier mon adresse',
      note: 'Si vous n’avez pas créé de compte Thoughty, ignorez cet e-mail.',
    },
    passwordReset: {
      subject: 'Réinitialisez votre mot de passe Thoughty',
      heading: 'Réinitialisez votre mot de passe',
      paragraphs: [
        'Vous avez demandé à réinitialiser le mot de passe de votre compte Thoughty. Ouvrez le lien ci-dessous pour en choisir un nouveau.',
        'Ce lien ne fonctionne qu’une fois et expire dans 1 heure.',
      ],
      action: 'Réinitialiser mon mot de passe',
      note: 'Si vous n’avez rien demandé, ignorez cet e-mail : votre mot de passe reste inchangé.',
    },
  },
};

/** The emails whose link carries a token also show it in full, for when the button does not work. */
const SHOWS_LINK: Record<LinkEmailKind, boolean> = {
  signUpLink: true,
  signUpNotice: false,
  emailVerification: true,
  passwordReset: true,
};

/** One paragraph of an account email, its text escaped. */
export function accountEmailParagraph(text: string, style = 'color: #666; font-size: 16px;'): string {
  return `\n          <p style="${style}">${escapeHtml(text)}</p>`;
}

/** The frame every email about the account shares: its language, its heading, then `bodyHtml`. */
export function renderAccountEmailHtml(lang: EmailLanguage, heading: string, bodyHtml: string): string {
  return `
        <div lang="${lang}" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">${escapeHtml(heading)}</h2>${bodyHtml}
        </div>
      `;
}

/**
 * An email about the account itself (signing up, proving an address, resetting the password) in `language`
 * (`en` or `fr`, English for anything else): its heading and paragraphs, one button to `url`, and the link
 * in full where it carries a token. Nothing in it comes from the reader but the link, which is escaped.
 */
export function renderLinkEmail(kind: LinkEmailKind, url: string, language: string | undefined): RenderedEmail {
  const lang = resolveEmailLanguage(language);
  const copy = COPY[lang][kind];
  const href = escapeHtml(url);
  const paragraphsHtml = copy.paragraphs.map((paragraph) => accountEmailParagraph(paragraph)).join('');
  const fallbackHtml = SHOWS_LINK[kind]
    ? `
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            ${escapeHtml(LINK_FALLBACK[lang])}<br>
            <a href="${href}" style="color: #6366f1;">${href}</a>
          </p>`
    : '';
  return {
    subject: copy.subject,
    html: renderAccountEmailHtml(
      lang,
      copy.heading,
      `${paragraphsHtml}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${href}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;">
              ${escapeHtml(copy.action)}
            </a>
          </div>${accountEmailParagraph(copy.note, 'color: #999; font-size: 14px;')}${fallbackHtml}`,
    ),
    text: [copy.subject, '', ...copy.paragraphs, '', url, '', copy.note, ''].join('\n'),
  };
}
