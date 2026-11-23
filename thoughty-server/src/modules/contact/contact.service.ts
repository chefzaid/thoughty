import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { apiError } from '@/common/errors';
import { describeEmailFailure, EmailService, type PlainTextEmail } from '@/modules/auth/services/email.service';
import type { ContactMessageDto } from './dto';

/** Where the Contact page's messages go when `CONTACT_EMAIL` is not set. */
export const DEFAULT_CONTACT_EMAIL = 'contact@swirlit.dev';

/** The inbox from `CONTACT_EMAIL` (the default when unset or blank), or null when it is not an address. */
export function resolveContactEmail(value: string | undefined): string | null {
  const address = value?.trim() || DEFAULT_CONTACT_EMAIL;
  return isEmail(address) ? address : null;
}

/** The email the inbox receives: plain text, the visitor as reply-to, their words unchanged. */
export function renderContactEmail({ name, email, message }: ContactMessageDto): PlainTextEmail {
  return {
    subject: `Thoughty contact: ${name}`,
    text: [
      `From: ${name} <${email}>`,
      'Sent from the Thoughty Contact page. Reply to this email to answer.',
      '',
      message,
      '',
    ].join('\n'),
    replyTo: { name, address: email },
  };
}

/** Emails each Contact page message to the deployment's inbox through the API's mail server. */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly inbox: string | null;

  constructor(
    private readonly emailService: EmailService,
    configService: ConfigService,
  ) {
    this.inbox = resolveContactEmail(configService.get<string>('CONTACT_EMAIL'));
    if (!this.inbox) {
      this.logger.warn('CONTACT_EMAIL is not an email address: the Contact form is off');
    }
  }

  async send(dto: ContactMessageDto): Promise<void> {
    if (dto.website?.trim()) {
      throw apiError(BadRequestException, 'CONTACT_INVALID_REQUEST');
    }
    if (!this.inbox || !this.emailService.isConfigured()) {
      throw apiError(ServiceUnavailableException, 'CONTACT_NOT_CONFIGURED');
    }
    try {
      await this.emailService.sendPlainTextEmail(this.inbox, renderContactEmail(dto));
    } catch (error) {
      // The error's name and SMTP code only: its message can quote the visitor's address
      this.logger.warn(`Contact message not sent: ${describeEmailFailure(error)}`);
      throw apiError(BadGatewayException, 'CONTACT_NOT_SENT');
    }
  }
}
