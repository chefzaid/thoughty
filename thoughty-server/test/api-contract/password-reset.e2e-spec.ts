import { createHash } from 'node:crypto';
import {
  describeContract,
  readRefreshCookie,
  signUpWithEmail,
  CONTRACT_PASSWORD,
} from './contract-suite';
import { CONTRACT_SMTP_ENV, linkToken, mailTo, mailsTo } from './contract-mail';

jest.mock('nodemailer', () => jest.requireActual('./contract-mail').fakeNodemailer);

const NEW_PASSWORD = 'Reset1234!';
const FORGOT_ANSWER = {
  success: true,
  message: 'If an account exists with this email, a reset link will be sent.',
};
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const codeIn = (text: string) => /security code is (\d{6})/.exec(text)?.[1] ?? '';

// Forgot and reset password each allow 3 calls an hour from one address; sign-in allows 5 in 15
// minutes. This suite uses all of them.
describeContract(
  'password-reset',
  (context) => {
    const call: typeof context.client.call = (operation, options) =>
      context.client.call(operation, options);
    const signIn = (identifier: string, password: string, status: number) =>
      call('POST /api/auth/login', { json: { identifier, password, website: '' }, status });

    it('emails a link that sets a new password once and signs every session out', async () => {
      const { alice } = context;
      const otherDevice = readRefreshCookie((await signIn(alice.email, CONTRACT_PASSWORD, 200)).headers['set-cookie']);

      const known = await call('POST /api/auth/forgot-password', { json: { email: alice.email }, status: 200 });
      const unknown = await call('POST /api/auth/forgot-password', {
        json: { email: 'nobody_reset@example.com' },
        status: 200,
      });
      expect(known.body).toEqual(FORGOT_ANSWER);
      expect(unknown.body).toEqual(FORGOT_ANSWER);

      // Her second email, after the sign-up link
      const email = await mailTo(alice.email, 2);
      expect(email.subject).toBe('Password Reset Request - Thoughty');
      const token = linkToken(email.text, '/reset-password');
      const [stored] = (await context.api.dataSource.query(
        'SELECT reset_token FROM users WHERE id = $1',
        [alice.id],
      )) as Array<{ reset_token: string }>;
      expect(stored?.reset_token).toBe(sha256(token));
      expect(mailsTo('nobody_reset@example.com')).toHaveLength(0);

      const reset = await call('POST /api/auth/reset-password', {
        json: { token, newPassword: NEW_PASSWORD },
        status: 200,
      });
      expect(reset.body).toEqual({ success: true, message: 'Password reset successfully' });
      expect(reset.headers['set-cookie']).toBeUndefined();

      for (const cookie of [alice.refreshCookie, otherDevice]) {
        await call('POST /api/auth/refresh', {
          headers: { Cookie: cookie },
          status: 401,
          code: 'AUTH_REFRESH_TOKEN_EXPIRED',
        });
      }
      await call('POST /api/auth/login', {
        json: { identifier: alice.email, password: CONTRACT_PASSWORD, website: '' },
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
      });
      await signIn(alice.email, NEW_PASSWORD, 200);
      await call('POST /api/auth/reset-password', {
        json: { token, newPassword: 'Again1234!' },
        status: 400,
        code: 'AUTH_INVALID_RESET_TOKEN',
      });
    });

    it('keeps two-factor sign-in on, and drops a code asked for with the old password', async () => {
      const { bob } = context;
      const setup = await call('POST /api/auth/two-factor/setup', { as: bob, status: 201 });
      await call('POST /api/auth/two-factor/enable', {
        as: bob,
        json: {
          challengeToken: (setup.body as { challengeToken: string }).challengeToken,
          code: codeIn((await mailTo(bob.email, 2)).text),
        },
        status: 200,
      });

      const pending = await signIn(bob.email, CONTRACT_PASSWORD, 200);
      const pendingCode = codeIn((await mailTo(bob.email, 3)).text);
      await call('POST /api/auth/forgot-password', { json: { email: bob.email }, status: 200 });
      const token = linkToken((await mailTo(bob.email, 4)).text, '/reset-password');
      await call('POST /api/auth/reset-password', {
        json: { token, newPassword: NEW_PASSWORD },
        status: 200,
      });

      await call('POST /api/auth/two-factor/verify', {
        json: { challengeToken: (pending.body as { challengeToken: string }).challengeToken, code: pendingCode },
        status: 401,
        code: 'AUTH_2FA_INVALID_CHALLENGE',
      });
      const signedIn = await signIn(bob.email, NEW_PASSWORD, 200);
      expect(signedIn.body).toMatchObject({ twoFactorRequired: true });
      expect(signedIn.headers['set-cookie']).toBeUndefined();
    });
  },
  { env: CONTRACT_SMTP_ENV, signUp: signUpWithEmail },
);
