import { RATE_LIMITS } from '../../src/common/rate-limit.constants';
import { describeContract, signUpWithEmail } from './contract-suite';
import { CONTRACT_SMTP_ENV, mailsTo } from './contract-mail';

jest.mock('nodemailer', () => jest.requireActual('./contract-mail').fakeNodemailer);

const INBOX = 'inbox@contact.test';
const message = {
  name: 'Camille Dupont',
  email: 'camille@example.com',
  message: 'Bonjour,\n<b>Can I import</b> my Day One journal? & thanks',
  website: '',
};

// The route allows five messages an hour from one address; the suite sends them in order, the sixth last
describeContract(
  'contact',
  (context) => {
    const call: typeof context.client.call = (operation, options) =>
      context.client.call(operation, options);

    it('emails a visitor message to CONTACT_EMAIL as plain text, with the visitor as reply-to', async () => {
      const sent = await call('POST /api/contact', { json: message, status: 202 });
      expect(sent.body).toEqual({ success: true });

      const [mail, ...others] = mailsTo(INBOX);
      expect(others).toEqual([]);
      expect(mail).toMatchObject({
        from: CONTRACT_SMTP_ENV.SMTP_FROM,
        subject: 'Thoughty contact: Camille Dupont',
        replyTo: { name: 'Camille Dupont', address: 'camille@example.com' },
      });
      expect(mail?.html).toBeUndefined();
      expect(mail?.text).toContain('From: Camille Dupont <camille@example.com>');
      expect(mail?.text).toContain(message.message);
    });

    it('refuses a message too short, a bad address or a line break in the name, sending nothing', async () => {
      await call('POST /api/contact', {
        json: { ...message, name: 'Camille\r\nBcc: someone@example.com', email: 'nope', message: 'Short' },
        status: 400,
        code: 'VALIDATION_FAILED',
      });
      expect(mailsTo(INBOX)).toHaveLength(1);
    });

    it('refuses a filled bot-trap field', async () => {
      await call('POST /api/contact', {
        json: { ...message, website: 'https://spam.example' },
        status: 400,
        code: 'CONTACT_INVALID_REQUEST',
      });
      expect(mailsTo(INBOX)).toHaveLength(1);
    });

    // Last: it uses up the address's messages for the hour
    it('allows five messages an hour from one address', async () => {
      const { alice } = context;
      await call('POST /api/contact', { as: alice, json: { ...message, email: alice.email }, status: 202 });
      await call('POST /api/contact', { json: message, status: 202 });
      expect(mailsTo(INBOX)).toHaveLength(3);
      expect(RATE_LIMITS.contactMessage.limit).toBe(5);

      const refused = await call('POST /api/contact', { json: message, status: 429, code: 'RATE_LIMITED' });
      expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
      expect(mailsTo(INBOX)).toHaveLength(3);
    });
  },
  {
    env: { ...CONTRACT_SMTP_ENV, CONTACT_EMAIL: INBOX },
    signUp: signUpWithEmail,
  },
);
