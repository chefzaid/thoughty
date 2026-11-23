import type { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const SMTP = { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'mailer@example.com', SMTP_PASS: 'pw', SMTP_FROM: 'Thoughty <hello@example.com>' };
const email = { subject: 'Thoughty contact: Camille', text: 'From: Camille\n\n<b>hi</b>', replyTo: { name: 'Camille', address: 'camille@example.com' } };

function createService(config: Record<string, unknown> = SMTP) {
  return new EmailService({ get: jest.fn((key: string) => config[key]) } as unknown as ConfigService);
}

describe('EmailService.sendPlainTextEmail', () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('sends text only, from the sender address, with the reply-to it is given', async () => {
    await createService().sendPlainTextEmail('contact@example.org', email);

    expect(sendMail).toHaveBeenCalledWith({
      from: SMTP.SMTP_FROM,
      to: 'contact@example.org',
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text,
    });
    expect(sendMail.mock.calls[0][0]).not.toHaveProperty('html');
  });

  it('falls back to SMTP_USER as the sender', async () => {
    await createService({ ...SMTP, SMTP_FROM: '' }).sendPlainTextEmail('contact@example.org', email);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: SMTP.SMTP_USER }));
  });

  it('throws when the transporter is not configured', async () => {
    await expect(createService({}).sendPlainTextEmail('contact@example.org', email)).rejects.toThrow('Email service not configured');
    expect(sendMail).not.toHaveBeenCalled();
  });
});
