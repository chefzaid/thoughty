import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: Partial<ConfigService>;
  let mockTransporter: { sendMail: jest.Mock };

  const createConfigService = (config: Record<string, any>): Partial<ConfigService> => ({
    get: jest.fn((key: string, defaultValue?: any) => config[key] ?? defaultValue),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
  });

  describe('constructor', () => {
    it('should create transporter when SMTP is configured', () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
      });

      service = new EmailService(configService as ConfigService);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'password',
        },
      });
    });

    it('should set secure to true for port 465', () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 465,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
      });

      service = new EmailService(configService as ConfigService);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: {
          user: 'user@example.com',
          pass: 'password',
        },
      });
    });

    it('should not create transporter when SMTP is not configured', () => {
      configService = createConfigService({});
      (nodemailer.createTransport as jest.Mock).mockClear();

      service = new EmailService(configService as ConfigService);

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  describe('isConfigured', () => {
    it('should return true when all SMTP settings are present', () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
      });

      service = new EmailService(configService as ConfigService);

      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when SMTP_HOST is missing', () => {
      configService = createConfigService({
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
      });

      service = new EmailService(configService as ConfigService);

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when SMTP_PORT is missing', () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
      });

      service = new EmailService(configService as ConfigService);

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when SMTP_USER is missing', () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_PASS: 'password',
      });

      service = new EmailService(configService as ConfigService);

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when SMTP_PASS is missing', () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
      });

      service = new EmailService(configService as ConfigService);

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('sendPasswordResetEmail', () => {
    beforeEach(() => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SMTP_FROM: 'noreply@example.com',
      });
      service = new EmailService(configService as ConfigService);
    });

    it('should send password reset email successfully', async () => {
      await service.sendPasswordResetEmail(
        'recipient@example.com',
        'https://example.com/reset?token=abc',
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Password Reset Request - Thoughty',
        }),
      );
    });

    it('should use SMTP_USER as from address when SMTP_FROM is not set', async () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
      });
      service = new EmailService(configService as ConfigService);

      await service.sendPasswordResetEmail(
        'recipient@example.com',
        'https://example.com/reset?token=abc',
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'user@example.com',
        }),
      );
    });

    it('should throw error when transporter is not configured', async () => {
      configService = createConfigService({});
      service = new EmailService(configService as ConfigService);

      await expect(
        service.sendPasswordResetEmail(
          'recipient@example.com',
          'https://example.com/reset?token=abc',
        ),
      ).rejects.toThrow('Email service not configured');
    });

    it('should include reset URL in email content', async () => {
      const resetUrl = 'https://example.com/reset?token=abc123';

      await service.sendPasswordResetEmail('recipient@example.com', resetUrl);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(resetUrl),
          text: expect.stringContaining(resetUrl),
        }),
      );
    });
  });

  describe('sendEmailVerificationEmail', () => {
    beforeEach(() => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SMTP_FROM: 'noreply@example.com',
      });
      service = new EmailService(configService as ConfigService);
    });

    it('should send email verification successfully', async () => {
      await service.sendEmailVerificationEmail(
        'recipient@example.com',
        'https://example.com/verify?token=abc',
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Verify your Thoughty email',
        }),
      );
    });

    it('should include verification URL in email content', async () => {
      const verificationUrl = 'https://example.com/verify?token=abc123';

      await service.sendEmailVerificationEmail('recipient@example.com', verificationUrl);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(verificationUrl),
          text: expect.stringContaining(verificationUrl),
        }),
      );
    });

    it('should throw error when transporter is not configured', async () => {
      configService = createConfigService({});
      service = new EmailService(configService as ConfigService);

      await expect(
        service.sendEmailVerificationEmail(
          'recipient@example.com',
          'https://example.com/verify?token=abc',
        ),
      ).rejects.toThrow('Email service not configured');
    });
  });

  describe('sendTwoFactorCodeEmail', () => {
    beforeEach(() => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SMTP_FROM: 'noreply@example.com',
      });
      service = new EmailService(configService as ConfigService);
    });

    it('sends the short-lived code in HTML and plain text', async () => {
      await service.sendTwoFactorCodeEmail('recipient@example.com', '123456', 10);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Your Thoughty security code',
          html: expect.stringContaining('123456'),
          text: expect.stringContaining('123456'),
        }),
      );
    });

    it('requires configured email delivery', async () => {
      service = new EmailService(createConfigService({}) as ConfigService);

      await expect(
        service.sendTwoFactorCodeEmail('recipient@example.com', '123456', 10),
      ).rejects.toThrow('Email service not configured');
    });
  });

  describe('sendAccountDeletionEmail', () => {
    beforeEach(() => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SMTP_FROM: 'noreply@example.com',
      });
      service = new EmailService(configService as ConfigService);
    });

    it('should send account deletion email successfully', async () => {
      await service.sendAccountDeletionEmail('recipient@example.com');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Account Deleted - Thoughty',
        }),
      );
    });

    it('should throw error when transporter is not configured', async () => {
      configService = createConfigService({});
      service = new EmailService(configService as ConfigService);

      await expect(service.sendAccountDeletionEmail('recipient@example.com')).rejects.toThrow(
        'Email service not configured',
      );
    });
  });

  describe('sendMemoirQuestionEmail', () => {
    const email = {
      subject: "This week's memoir question",
      heading: 'Your question for this week',
      question: 'Which <adult> outside your family left a mark on your childhood?',
      actionLabel: 'Answer now',
      actionUrl: 'https://thoughty.example.com/memoir?question=childhood-adult&x="y"',
      footer: 'Pause these emails in Memoir settings.',
    };

    it('sends the localized question with escaped markup and a plain-text alternative', async () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SMTP_FROM: 'noreply@example.com',
      });
      service = new EmailService(configService as ConfigService);

      await service.sendMemoirQuestionEmail('writer@example.com', email);

      const message = mockTransporter.sendMail.mock.calls[0][0];
      expect(message).toEqual(expect.objectContaining({
        from: 'noreply@example.com',
        to: 'writer@example.com',
        subject: "This week's memoir question",
      }));
      expect(message.html).toContain('Which &lt;adult&gt; outside your family');
      expect(message.html).toContain('href="https://thoughty.example.com/memoir?question=childhood-adult&amp;x=&quot;y&quot;"');
      expect(message.text).toContain('Answer now: https://thoughty.example.com/memoir?question=childhood-adult');
      expect(message.text).toContain('Pause these emails in Memoir settings.');
    });

    it('should throw error when transporter is not configured', async () => {
      configService = createConfigService({});
      service = new EmailService(configService as ConfigService);

      await expect(service.sendMemoirQuestionEmail('writer@example.com', email)).rejects.toThrow(
        'Email service not configured',
      );
    });
  });

  describe('sendRenderedEmail', () => {
    const email = {
      subject: 'On this day in your journal',
      html: '<p>Hello</p>',
      text: 'Hello',
      headers: { 'List-Unsubscribe': '<https://thoughty.example.com/api/on-this-day-email/unsubscribe?token=1.x>' },
    };

    it('sends the rendered content with its headers from the configured address', async () => {
      configService = createConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
      });
      service = new EmailService(configService as ConfigService);

      await service.sendRenderedEmail('writer@example.com', email);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'user@example.com',
        to: 'writer@example.com',
        subject: 'On this day in your journal',
        html: '<p>Hello</p>',
        text: 'Hello',
        headers: email.headers,
      });
    });

    it('throws when the transporter is not configured', async () => {
      configService = createConfigService({});
      service = new EmailService(configService as ConfigService);

      await expect(service.sendRenderedEmail('writer@example.com', email)).rejects.toThrow('Email service not configured');
    });
  });
});
