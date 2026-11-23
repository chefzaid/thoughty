/**
 * The mail server of the contract suites that send email. A suite mocks `nodemailer` with
 * `fakeNodemailer` (`jest.mock('nodemailer', () => jest.requireActual('./contract-mail').fakeNodemailer)`)
 * and passes `CONTRACT_SMTP_ENV`, so the real `EmailService` hands each message to `sentMail`
 * instead of an SMTP server. This file imports nothing, as the mock loads it while the API boots.
 */
export interface SentMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: unknown;
}

/** What the API handed the mail server; nothing leaves the process. */
export const sentMail: SentMail[] = [];

export const fakeNodemailer = {
  createTransport: () => ({
    sendMail: async (message: SentMail) => {
      sentMail.push(message);
      return {};
    },
  }),
};

export const CONTRACT_FRONTEND_URL = 'https://thoughty.contract.test';

export const CONTRACT_SMTP_ENV: Record<string, string> = {
  SMTP_HOST: 'smtp.contract.test',
  SMTP_PORT: '587',
  SMTP_USER: 'contract',
  SMTP_PASS: 'contract-secret',
  SMTP_FROM: 'Thoughty <hello@contract.test>',
  FRONTEND_URL: CONTRACT_FRONTEND_URL,
};

/** The emails sent to an address so far. */
export function mailsTo(address: string): SentMail[] {
  return sentMail.filter((message) => message.to === address);
}

/** The last email sent to an address, once the API's background send has run. */
export async function mailTo(address: string, count = 1): Promise<SentMail> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const sent = mailsTo(address);
    if (sent.length >= count) return sent[sent.length - 1]!;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No email number ${count} to ${address}`);
}

/** The token of the app link to `path` (such as `/reset-password`) an email carries. */
export function linkToken(text: string, path: string): string {
  const escapedUrl = `${CONTRACT_FRONTEND_URL}${path}`.replace(/[.?/]/g, '\\$&');
  const link = new RegExp(`${escapedUrl}\\?token=([0-9a-f]+)`).exec(text);
  if (!link?.[1]) throw new Error(`The email carries no ${path} link`);
  return link[1];
}
