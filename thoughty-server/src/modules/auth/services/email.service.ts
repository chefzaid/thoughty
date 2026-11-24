import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { escapeHtml, isPlaceholderEmail } from '@/common/utils';
import { renderLinkEmail } from './account-link-emails';
import {
  renderAccountDeletionEmail,
  renderTwoFactorCodeEmail,
  type TwoFactorCodePurpose,
} from './account-notice-emails';

/** Localized copy for the weekly guided-memoir question email. */
export interface MemoirQuestionEmail {
  subject: string;
  heading: string;
  question: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
}

/** An email whose content is already rendered, with any extra headers it needs (such as List-Unsubscribe). */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

/** A plain-text email with the address replies should go to, such as a Contact page message. */
export interface PlainTextEmail {
  subject: string;
  text: string;
  replyTo: { name: string; address: string };
}

/**
 * A failed send as it may be logged: the error's name and SMTP reply code, never its message,
 * which can quote the address.
 */
export function describeEmailFailure(error: unknown): string {
  const code = (error as { responseCode?: unknown } | null)?.responseCode;
  return `${error instanceof Error ? error.name : 'unknown error'}${typeof code === 'number' ? ` ${code}` : ''}`;
}

/** Implicit TLS (SMTPS); any other port starts in plain text and upgrades with STARTTLS. */
const SMTPS_PORT = 465;

/**
 * `SMTP_PORT` as a number. The environment gives text (`"465"`), so it is parsed here once: a whole
 * number from 1 to 65535, or null for anything else, which leaves email delivery off.
 */
export function parseSmtpPort(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,5}$/.test(text)) {
    return null;
  }
  const port = Number(text);
  return port >= 1 && port <= 65535 ? port : null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly port: number | null;

  constructor(private readonly configService: ConfigService) {
    const rawPort: unknown = this.configService.get('SMTP_PORT');
    const port = parseSmtpPort(rawPort);
    this.port = port;
    if (port === null && rawPort !== undefined && rawPort !== '') {
      this.logger.warn('SMTP_PORT is not a port number from 1 to 65535: email delivery is off');
    }
    if (port !== null && this.isConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST'),
        port,
        secure: port === SMTPS_PORT,
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  isConfigured(): boolean {
    return !!(
      this.configService.get('SMTP_HOST') &&
      this.port !== null &&
      this.configService.get('SMTP_USER') &&
      this.configService.get('SMTP_PASS')
    );
  }

  /**
   * Sends one email from `SMTP_FROM` (else `SMTP_USER`). An address on the reserved `.invalid` domain,
   * such as the placeholder of an account that had none, is skipped: no mail can reach it.
   */
  private async deliver(toEmail: string, mail: Omit<nodemailer.SendMailOptions, 'from' | 'to'>): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }
    if (isPlaceholderEmail(toEmail)) {
      this.logger.debug('Email to a placeholder address skipped');
      return;
    }
    await this.transporter.sendMail({
      ...mail,
      from: this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER'),
      to: toEmail,
    });
  }

  /** The link that sets a new password, in the account's language (`en`, `fr`; English otherwise). */
  async sendPasswordResetEmail(toEmail: string, resetUrl: string, language?: string): Promise<void> {
    await this.sendRenderedEmail(toEmail, renderLinkEmail('passwordReset', resetUrl, language));
  }

  /** The link that proves a new address, in the account's language (`en`, `fr`; English otherwise). */
  async sendEmailVerificationEmail(toEmail: string, verificationUrl: string, language?: string): Promise<void> {
    await this.sendRenderedEmail(toEmail, renderLinkEmail('emailVerification', verificationUrl, language));
  }

  /** The link that creates the account for an address that has none yet, in the visitor's language. */
  async sendSignUpLinkEmail(toEmail: string, signUpUrl: string, language?: string): Promise<void> {
    await this.sendRenderedEmail(toEmail, renderLinkEmail('signUpLink', signUpUrl, language));
  }

  /** Sent instead of a sign-up link when the address already has an account, in the visitor's language. */
  async sendSignUpNoticeEmail(toEmail: string, signInUrl: string, language?: string): Promise<void> {
    await this.sendRenderedEmail(toEmail, renderLinkEmail('signUpNotice', signInUrl, language));
  }

  /** The code that confirms `purpose`, in the account's language (`en`, `fr`; English otherwise). */
  async sendTwoFactorCodeEmail(
    toEmail: string,
    code: string,
    expiresInMinutes: number,
    purpose: TwoFactorCodePurpose,
    language?: string,
  ): Promise<void> {
    await this.sendRenderedEmail(toEmail, renderTwoFactorCodeEmail(code, expiresInMinutes, purpose, language));
  }

  async sendMemoirQuestionEmail(toEmail: string, email: MemoirQuestionEmail): Promise<void> {
    const actionUrl = escapeHtml(email.actionUrl);

    await this.deliver(toEmail, {
      subject: email.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">${escapeHtml(email.heading)}</h2>
          <p style="color: #111; font-size: 20px; line-height: 1.5;">${escapeHtml(email.question)}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;">
              ${escapeHtml(email.actionLabel)}
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">${escapeHtml(email.footer)}</p>
        </div>
      `,
      text: `${email.heading}\n\n${email.question}\n\n${email.actionLabel}: ${email.actionUrl}\n\n${email.footer}\n`,
    });
  }

  async sendRenderedEmail(toEmail: string, email: RenderedEmail): Promise<void> {
    await this.deliver(toEmail, {
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    });
  }

  /** Sends text only, no HTML, so nothing the sender wrote is ever rendered as markup. */
  async sendPlainTextEmail(toEmail: string, email: PlainTextEmail): Promise<void> {
    await this.deliver(toEmail, {
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text,
    });
  }

  /** The confirmation that the account is deleted, in its language (`en`, `fr`; English otherwise). */
  async sendAccountDeletionEmail(toEmail: string, language?: string): Promise<void> {
    await this.sendRenderedEmail(toEmail, renderAccountDeletionEmail(language));
  }
}
