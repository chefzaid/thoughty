import { createHash } from 'node:crypto';
import {
  describeContract,
  readRefreshCookie,
  signUpWithEmail,
  CONTRACT_PASSWORD,
} from './contract-suite';
import {
  CONTRACT_FRONTEND_URL as FRONTEND_URL,
  CONTRACT_SMTP_ENV,
  linkToken,
  mailTo,
  mailsTo,
} from './contract-mail';

jest.mock('nodemailer', () => jest.requireActual('./contract-mail').fakeNodemailer);

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenIn = (text: string) => linkToken(text, '/complete-sign-up');

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
      expect(mailsTo('carol_sign-up@example.com')).toHaveLength(1);
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
    env: CONTRACT_SMTP_ENV,
    signUp: signUpWithEmail,
  },
);
