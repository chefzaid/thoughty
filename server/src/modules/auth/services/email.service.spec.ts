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
      await service.sendPasswordResetEmail('recipient@example.com', 'https://example.com/reset?token=abc');

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

      await service.sendPasswordResetEmail('recipient@example.com', 'https://example.com/reset?token=abc');

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
        service.sendPasswordResetEmail('recipient@example.com', 'https://example.com/reset?token=abc'),
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
});
