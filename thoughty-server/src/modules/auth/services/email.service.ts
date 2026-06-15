import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
        
        If you did not request this deletion, or if you believe this was done in error, 
        please contact our support team immediately.
        
        We're sorry to see you go. Thank you for using Thoughty.
      `,
    });
  }
}
