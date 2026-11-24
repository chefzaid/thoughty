import type { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService, describeEmailFailure } from './email.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const SMTP = { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_USER: 'mailer@example.com', SMTP_PASS: 'pw', SMTP_FROM: 'Thoughty <hello@example.com>' };

function createService(config: Record<string, unknown> = SMTP) {
  return new EmailService({ get: jest.fn((key: string) => config[key]) } as unknown as ConfigService);
}

describe('EmailService sign-up emails', () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('sends the sign-up link, escaped in HTML and whole in the text part', async () => {
    const url = 'https://thoughty.example/complete-sign-up?token=abc&x="1"';

    await createService().sendSignUpLinkEmail('new@example.com', url);

    const mail = sendMail.mock.calls[0][0] as { from: string; to: string; subject: string; html: string; text: string };
    expect(mail).toMatchObject({ from: SMTP.SMTP_FROM, to: 'new@example.com', subject: 'Finish creating your Thoughty account' });
    expect(mail.html).toContain('href="https://thoughty.example/complete-sign-up?token=abc&amp;x=&quot;1&quot;"');
    expect(mail.html).toContain('expires in 24 hours');
    expect(mail.text).toContain(url);
    expect(mail.text).toContain('enter the password you chose');
  });

  it('tells an address that has an account to sign in or reset its password, with no link to act on', async () => {
    await createService().sendSignUpNoticeEmail('writer@example.com', 'https://thoughty.example/login');

    const mail = sendMail.mock.calls[0][0] as { to: string; subject: string; html: string; text: string };
    expect(mail.to).toBe('writer@example.com');
    expect(mail.subject).toBe('Someone tried to sign up to Thoughty with your email');
    expect(mail.html).toContain('href="https://thoughty.example/login"');
    expect(mail.text).toContain('Forgot password?');
    expect(mail.text).not.toContain('token');
  });

  it('writes each account email in the language it is given', async () => {
    const service = createService();
    await service.sendSignUpLinkEmail('new@example.com', 'https://x/complete-sign-up?token=1', 'fr');
    await service.sendSignUpNoticeEmail('writer@example.com', 'https://x/login', 'fr');
    await service.sendEmailVerificationEmail('writer@example.com', 'https://x/verify-email?token=2', 'fr');

    expect(sendMail.mock.calls.map(([mail]) => (mail as { subject: string }).subject)).toEqual([
      'Terminez la création de votre compte Thoughty',
      'Quelqu’un a tenté de s’inscrire à Thoughty avec votre adresse e-mail',
      'Vérifiez votre adresse e-mail Thoughty',
    ]);
  });

  it('needs a configured mail server', async () => {
    await expect(createService({}).sendSignUpLinkEmail('a@b.c', 'https://x')).rejects.toThrow('Email service not configured');
    await expect(createService({}).sendSignUpNoticeEmail('a@b.c', 'https://x')).rejects.toThrow('Email service not configured');
  });
});

describe('describeEmailFailure', () => {
  it('keeps the error name and SMTP reply code, never the message', () => {
    expect(describeEmailFailure(Object.assign(new Error('550 a@b.c unknown'), { responseCode: 550 }))).toBe('Error 550');
    expect(describeEmailFailure(new TypeError('a@b.c'))).toBe('TypeError');
    expect(describeEmailFailure(null)).toBe('unknown error');
  });
});
