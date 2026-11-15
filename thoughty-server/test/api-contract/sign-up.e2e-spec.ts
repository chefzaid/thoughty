import { createHash } from 'node:crypto';
import { describeContract, readRefreshCookie, CONTRACT_PASSWORD } from './contract-suite';
import type { ContractClient, ContractUser } from './contract-client';

/** What the API handed the mail server; nothing leaves the process. */
const mockSentMail: Array<{ to: string; subject: string; text: string }> = [];

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: async (message: { to: string; subject: string; text: string }) => {
      mockSentMail.push(message);
      return {};
    },
  }),
}));

const FRONTEND_URL = 'https://thoughty.contract.test';
const STARTED = { verificationRequired: true, message: 'Check your email to finish creating your account.' };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** The last email sent to an address, once the API's background send has run. */
async function mailTo(address: string, count = 1): Promise<{ subject: string; text: string }> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const sent = mockSentMail.filter((message) => message.to === address);
    if (sent.length >= count) return sent[sent.length - 1]!;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No email number ${count} to ${address}`);
}

function tokenIn(text: string): string {
  const link = /https:\/\/thoughty\.contract\.test\/complete-sign-up\?token=([0-9a-f]+)/.exec(text);
  if (!link?.[1]) throw new Error('The email carries no sign-up link');
  return link[1];
}

/** Signs a writer up the way production does: the form, then the emailed link. */
async function signUpWithEmail(client: ContractClient, username: string): Promise<ContractUser> {
  const email = `${username}@example.com`;
  const started = await client.call('POST /api/auth/register', {
    json: { email, password: CONTRACT_PASSWORD, username, website: '' },
    status: 202,
  });
  expect(started.body).toEqual(STARTED);
  expect(started.headers['set-cookie']).toBeUndefined();
  const completed = await client.call('POST /api/auth/register/complete', {
    json: { token: tokenIn((await mailTo(email)).text), password: CONTRACT_PASSWORD },
    status: 201,
  });
  const body = completed.body as { user: { id: number }; accessToken: string };
  return {
    id: body.user.id,
    username,
    email,
    password: CONTRACT_PASSWORD,
    accessToken: body.accessToken,
    refreshCookie: readRefreshCookie(completed.headers['set-cookie']),
  };
}

// Both routes allow 5 calls per 15 minutes from one address, and alice and bob use 2 of each.
describeContract(
  'sign-up',
  (context) => {
    const call: typeof context.client.call = (operation, options) =>
      context.client.call(operation, options);

    it('signed alice up from her link with a verified email', async () => {
      const me = await call('GET /api/auth/me', { as: context.alice, status: 200 });
      expect(me.body).toMatchObject({ username: context.alice.username, emailVerified: true, authProvider: 'local' });
      await expect(
        context.api.dataSource.query('SELECT COUNT(*)::int AS count FROM sign_up_requests WHERE token_hash IS NOT NULL'),
      ).resolves.toEqual([{ count: 0 }]);
    });

    it('answers an address with an account like a new one, and only emails it a notice', async () => {
      const { alice } = context;
      const taken = await call('POST /api/auth/register', {
        json: { email: alice.email, password: 'Other1234!', username: 'someone_else', website: '' },
        status: 202,
      });
      const fresh = await call('POST /api/auth/register', {
        json: { email: 'carol_sign-up@example.com', password: CONTRACT_PASSWORD, username: alice.username, website: '' },
        status: 202,
      });
      expect(taken.body).toEqual(fresh.body);
      expect(Object.keys(taken.headers).sort()).toEqual(Object.keys(fresh.headers).sort());

      const notice = await mailTo(alice.email, 2);
      expect(notice.subject).toBe('Someone tried to sign up to Thoughty with your email');
      expect(notice.text).not.toContain('complete-sign-up');
      expect(notice.text).toContain(`${FRONTEND_URL}/login`);
      // Her password is unchanged
      await call('POST /api/auth/login', {
        json: { identifier: alice.email, password: CONTRACT_PASSWORD, website: '' },
        status: 200,
      });

      // A second request inside the minute sends nothing more
      await call('POST /api/auth/register', {
        json: { email: 'carol_sign-up@example.com', password: CONTRACT_PASSWORD, website: '' },
        status: 202,
      });
      const link = await mailTo('carol_sign-up@example.com');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockSentMail.filter((message) => message.to === 'carol_sign-up@example.com')).toHaveLength(1);
      const [stored] = (await context.api.dataSource.query(
        `SELECT token_hash, password_hash FROM sign_up_requests WHERE email = 'carol_sign-up@example.com'`,
      )) as Array<{ token_hash: string; password_hash: string }>;
      expect(stored?.token_hash).toBe(sha256(tokenIn(link.text)));
      expect(stored?.password_hash).not.toContain(CONTRACT_PASSWORD);
    });

    it('needs the chosen password, and a free username, to create the account from the link', async () => {
      const token = tokenIn((await mailTo('carol_sign-up@example.com')).text);
      await call('POST /api/auth/register/complete', {
        json: { token, password: 'Wrong1234!' },
        status: 401,
        code: 'AUTH_INVALID_PASSWORD',
      });
      // carol asked for alice's username: she learns it is taken only now, having proven her address
      await call('POST /api/auth/register/complete', {
        json: { token, password: CONTRACT_PASSWORD },
        status: 409,
        code: 'AUTH_USERNAME_TAKEN',
      });
      const created = await call('POST /api/auth/register/complete', {
        json: { token, password: CONTRACT_PASSWORD, username: 'carol_sign-up' },
        status: 201,
      });
      expect(created.body).toMatchObject({
        user: { username: 'carol_sign-up', email: 'carol_sign-up@example.com', emailVerified: true, isNewUser: true },
      });
      readRefreshCookie(created.headers['set-cookie']);
    });
  },
  {
    env: {
      SMTP_HOST: 'smtp.contract.test',
      SMTP_PORT: '587',
      SMTP_USER: 'contract',
      SMTP_PASS: 'contract-secret',
      SMTP_FROM: 'Thoughty <hello@contract.test>',
      FRONTEND_URL,
    },
    signUp: signUpWithEmail,
  },
);
