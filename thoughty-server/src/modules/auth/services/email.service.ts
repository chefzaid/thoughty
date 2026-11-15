import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { escapeHtml } from '@/common/utils';

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

/**
 * A failed send as it may be logged: the error's name and SMTP reply code, never its message,
 * which can quote the address.
 */
export function describeEmailFailure(error: unknown): string {
  const code = (error as { responseCode?: unknown } | null)?.responseCode;
  return `${error instanceof Error ? error.name : 'unknown error'}${typeof code === 'number' ? ` ${code}` : ''}`;
}

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    if (this.isConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<number>('SMTP_PORT') === 465,
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
      this.configService.get('SMTP_PORT') &&
      this.configService.get('SMTP_USER') &&
      this.configService.get('SMTP_PASS')
    );
  }

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

    await this.transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Password Reset Request - Thoughty',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="color: #666; font-size: 16px;">
            You requested to reset your password for your Thoughty account.
          </p>
          <p style="color: #666; font-size: 16px;">
            Click the button below to reset your password. This link will expire in 1 hour.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #6366f1; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            If you didn't request this, please ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #6366f1;">${resetUrl}</a>
          </p>
        </div>
      `,
      text: `
        Password Reset Request - Thoughty
        
        You requested to reset your password for your Thoughty account.
        
        Click the link below to reset your password. This link will expire in 1 hour.
        
        ${resetUrl}
        
        If you didn't request this, please ignore this email. Your password will remain unchanged.
      `,
    });
  }

  async sendEmailVerificationEmail(toEmail: string, verificationUrl: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

    await this.transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Verify your Thoughty email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Verify your email</h2>
          <p style="color: #666; font-size: 16px;">
            Please verify this email address to finish securing your Thoughty account.
          </p>
          <p style="color: #666; font-size: 16px;">
            This verification link will expire in 24 hours.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;">
              Verify Email
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            If you did not create a Thoughty account, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verificationUrl}" style="color: #6366f1;">${verificationUrl}</a>
          </p>
        </div>
      `,
      text: `
        Verify your Thoughty email

        Please verify this email address to finish securing your Thoughty account.
        This verification link will expire in 24 hours.

        ${verificationUrl}

        If you did not create a Thoughty account, please ignore this email.
      `,
    });
  }

  /** The link that creates the account for an address that has none yet. */
  async sendSignUpLinkEmail(toEmail: string, signUpUrl: string): Promise<void> {
    await this.sendRenderedEmail(toEmail, {
      subject: 'Finish creating your Thoughty account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Finish creating your account</h2>
          <p style="color: #666; font-size: 16px;">
            Someone, hopefully you, asked to create a Thoughty account with this email address.
            Open the link below and enter the password you chose to finish.
          </p>
          <p style="color: #666; font-size: 16px;">This link works once and expires in 24 hours.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(signUpUrl)}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;">
              Create my account
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            If you did not sign up, ignore this email: no account is created without it.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${escapeHtml(signUpUrl)}" style="color: #6366f1;">${escapeHtml(signUpUrl)}</a>
          </p>
        </div>
      `,
      text: [
        'Finish creating your Thoughty account',
        '',
        'Someone, hopefully you, asked to create a Thoughty account with this email address.',
        'Open the link below and enter the password you chose to finish.',
        'This link works once and expires in 24 hours.',
        '',
        signUpUrl,
        '',
        'If you did not sign up, ignore this email: no account is created without it.',
        '',
      ].join('\n'),
    });
  }

  /** Sent instead of a sign-up link when the address already has an account. */
  async sendSignUpNoticeEmail(toEmail: string, signInUrl: string): Promise<void> {
    await this.sendRenderedEmail(toEmail, {
      subject: 'Someone tried to sign up to Thoughty with your email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">You already have an account</h2>
          <p style="color: #666; font-size: 16px;">
            Someone tried to create a Thoughty account with this email address, which already has one.
            Nothing was changed.
          </p>
          <p style="color: #666; font-size: 16px;">
            If it was you, sign in instead. If you forgot your password, choose
            <strong>Forgot password?</strong> on the sign-in page to reset it.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(signInUrl)}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-size: 16px;">
              Sign in
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">If it was not you, you can ignore this email.</p>
        </div>
      `,
      text: [
        'Someone tried to sign up to Thoughty with your email',
        '',
        'Someone tried to create a Thoughty account with this email address, which already has one.',
        'Nothing was changed.',
        'If it was you, sign in instead. If you forgot your password, choose "Forgot password?" on the sign-in page to reset it.',
        '',
        signInUrl,
        '',
        'If it was not you, you can ignore this email.',
        '',
      ].join('\n'),
    });
  }

  async sendTwoFactorCodeEmail(
    toEmail: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

    await this.transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Your Thoughty security code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Your security code</h2>
          <p style="color: #666; font-size: 16px;">Use this code to finish signing in to Thoughty:</p>
          <p style="color: #111; font-size: 32px; font-weight: 700; letter-spacing: 8px;">${code}</p>
          <p style="color: #666; font-size: 14px;">This code expires in ${expiresInMinutes} minutes and can be used once.</p>
          <p style="color: #999; font-size: 14px;">If you did not request this code, change your password.</p>
        </div>
      `,
      text: `Your Thoughty security code is ${code}. It expires in ${expiresInMinutes} minutes and can be used once.`,
    });
  }

  async sendMemoirQuestionEmail(toEmail: string, email: MemoirQuestionEmail): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
    const actionUrl = escapeHtml(email.actionUrl);

    await this.transporter.sendMail({
      from: fromAddress,
      to: toEmail,
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
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER'),
      to: toEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    });
  }

  async sendAccountDeletionEmail(toEmail: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

    await this.transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Account Deleted - Thoughty',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Account Deletion Confirmation</h2>
          <p style="color: #666; font-size: 16px;">
            Your Thoughty account has been successfully deleted as per your request.
          </p>
          <p style="color: #666; font-size: 16px;">
            You will no longer be able to access your account or any associated data.
            Your journal and everything stored with your account will be permanently erased within 30 days.
          </p>
          <p style="color: #666; font-size: 16px;">
            If you did not request this deletion, or if you believe this was done in error, 
            please contact our support team immediately.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 14px;">
            We're sorry to see you go. Thank you for using Thoughty.
          </p>
        </div>
      `,
      text: `
        Account Deletion Confirmation - Thoughty
        
        Your Thoughty account has been successfully deleted as per your request.
        
        You will no longer be able to access your account or any associated data.
        Your journal and everything stored with your account will be permanently erased within 30 days.
        
        If you did not request this deletion, or if you believe this was done in error, 
        please contact our support team immediately.
        
        We're sorry to see you go. Thank you for using Thoughty.
      `,
    });
  }
}
