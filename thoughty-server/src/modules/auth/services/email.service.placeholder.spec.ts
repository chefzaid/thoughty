import type { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const SMTP: Record<string, unknown> = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer@example.com',
  SMTP_PASS: 'pw',
};

describe('EmailService and placeholder addresses', () => {
  let sendMail: jest.Mock;
  let service: EmailService;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    service = new EmailService({ get: jest.fn((key: string) => SMTP[key]) } as unknown as ConfigService);
  });

  const senders: Array<[string, (to: string) => Promise<void>]> = [
    ['password reset', (to) => service.sendPasswordResetEmail(to, 'https://thoughty.test/reset')],
    ['verification', (to) => service.sendEmailVerificationEmail(to, 'https://thoughty.test/verify')],
    ['sign-up link', (to) => service.sendSignUpLinkEmail(to, 'https://thoughty.test/complete')],
    ['sign-up notice', (to) => service.sendSignUpNoticeEmail(to, 'https://thoughty.test/login')],
    ['two-factor code', (to) => service.sendTwoFactorCodeEmail(to, '123456', 10, 'login')],
    [
      'memoir question',
      (to) =>
        service.sendMemoirQuestionEmail(to, {
          subject: 'S',
          heading: 'H',
          question: 'Q',
          actionLabel: 'A',
          actionUrl: 'https://thoughty.test/memoir',
          footer: 'F',
        }),
    ],
    ['rendered', (to) => service.sendRenderedEmail(to, { subject: 'S', html: '<p>H</p>', text: 'T' })],
    [
      'plain text',
      (to) => service.sendPlainTextEmail(to, { subject: 'S', text: 'T', replyTo: { name: 'N', address: 'n@example.com' } }),
    ],
    ['account deletion', (to) => service.sendAccountDeletionEmail(to)],
  ];

  it.each(senders)('never sends the %s email to a placeholder, and sends it to a real address', async (_name, send) => {
    await send('user-7@invalid');
    await send('writer@mail.invalid');
    expect(sendMail).not.toHaveBeenCalled();

    await send('writer@example.com');
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'writer@example.com', from: 'mailer@example.com' }));
  });
});
