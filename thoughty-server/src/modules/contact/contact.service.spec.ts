import { BadGatewayException, BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import type { EmailService } from '@/modules/auth/services/email.service';
import {
  ContactService,
  DEFAULT_CONTACT_EMAIL,
  renderContactEmail,
  resolveContactEmail,
} from './contact.service';

const dto = { name: 'Camille <b>', email: 'camille@example.com', message: 'Hello,\n<script>alert(1)</script> & more' };

describe('resolveContactEmail', () => {
  it('uses CONTACT_EMAIL, else the default inbox', () => {
    expect(DEFAULT_CONTACT_EMAIL).toBe('contact@swirlit.dev');
    expect(resolveContactEmail(undefined)).toBe('contact@swirlit.dev');
    expect(resolveContactEmail('   ')).toBe('contact@swirlit.dev');
    expect(resolveContactEmail(' help@example.org ')).toBe('help@example.org');
  });

  it('refuses a value that is not an address', () => {
    expect(resolveContactEmail('support team')).toBeNull();
  });
});

describe('renderContactEmail', () => {
  it('keeps the visitor words as plain text, with them as reply-to', () => {
    expect(renderContactEmail(dto)).toEqual({
      subject: 'Thoughty contact: Camille <b>',
      text:
        'From: Camille <b> <camille@example.com>\nSent from the Thoughty Contact page. Reply to this email to answer.\n\n' +
        'Hello,\n<script>alert(1)</script> & more\n',
      replyTo: { name: 'Camille <b>', address: 'camille@example.com' },
    });
    expect(renderContactEmail(dto)).not.toHaveProperty('html');
  });
});

describe('ContactService', () => {
  const emailService = { isConfigured: jest.fn(), sendPlainTextEmail: jest.fn() };
  const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
  const create = (values: Record<string, string> = {}) =>
    new ContactService(emailService as unknown as EmailService, config(values));
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.isConfigured.mockReturnValue(true);
    emailService.sendPlainTextEmail.mockResolvedValue(undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it('emails the message to CONTACT_EMAIL', async () => {
    await create({ CONTACT_EMAIL: 'help@example.org' }).send(dto);
    expect(emailService.sendPlainTextEmail).toHaveBeenCalledWith('help@example.org', renderContactEmail(dto));
  });

  it('emails the default inbox when CONTACT_EMAIL is not set', async () => {
    await create().send({ ...dto, website: '  ' });
    expect(emailService.sendPlainTextEmail).toHaveBeenCalledWith('contact@swirlit.dev', expect.anything());
  });

  it('refuses a filled bot-trap field without sending', async () => {
    await expectApiError(create().send({ ...dto, website: 'https://spam.example' }), BadRequestException, 'CONTACT_INVALID_REQUEST');
    expect(emailService.sendPlainTextEmail).not.toHaveBeenCalled();
  });

  it('answers 503 without a mail server', async () => {
    emailService.isConfigured.mockReturnValue(false);
    await expectApiError(create().send(dto), ServiceUnavailableException, 'CONTACT_NOT_CONFIGURED');
    expect(emailService.sendPlainTextEmail).not.toHaveBeenCalled();
  });

  it('answers 503, and warns once at start, when CONTACT_EMAIL is not an address', async () => {
    const service = create({ CONTACT_EMAIL: 'support team' });
    expect(warn).toHaveBeenCalledWith('CONTACT_EMAIL is not an email address: the Contact form is off');
    await expectApiError(service.send(dto), ServiceUnavailableException, 'CONTACT_NOT_CONFIGURED');
  });

  it('answers 502 when the mail server refuses, logging no address', async () => {
    emailService.sendPlainTextEmail.mockRejectedValue(Object.assign(new Error('550 camille@example.com rejected'), { responseCode: 550 }));
    await expectApiError(create().send(dto), BadGatewayException, 'CONTACT_NOT_SENT');
    expect(warn).toHaveBeenCalledWith('Contact message not sent: Error 550');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('camille@example.com');
  });
});
