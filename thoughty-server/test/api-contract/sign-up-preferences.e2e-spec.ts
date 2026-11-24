import { describeContract, signUpWithEmail, CONTRACT_PASSWORD, SIGN_UP_STARTED } from './contract-suite';
import { CONTRACT_SMTP_ENV, linkToken, mailTo, mailsTo } from './contract-mail';

jest.mock('nodemailer', () => jest.requireActual('./contract-mail').fakeNodemailer);

/**
 * The visitor's language and theme carried into the account they create: the sign-up email is in that
 * language, and the account starts with both. A suite of its own, as registration allows five attempts
 * per client in 15 minutes: alice and bob use two, this suite three.
 */
describeContract(
  'sign-up-preferences',
  (context) => {
    const call: typeof context.client.call = (operation, options) =>
      context.client.call(operation, options);

    it('starts an account whose sign-up sent neither in English and dark, after an English email', async () => {
      const { alice } = context;
      expect((await mailTo(alice.email)).subject).toBe('Finish creating your Thoughty account');

      const config = await call('GET /api/config', { as: alice, status: 200 });
      expect(config.body).toMatchObject({ language: 'en', theme: 'dark' });
    });

    it('emails a French visitor on a light page in French and starts the account in French and light', async () => {
      const email = 'camille_prefs@example.com';
      const started = await call('POST /api/auth/register', {
        json: { email, password: CONTRACT_PASSWORD, username: 'camille_prefs', website: '', language: 'fr', theme: 'light' },
        status: 202,
      });
      expect(started.body).toEqual(SIGN_UP_STARTED);

      const link = await mailTo(email);
      expect(link.subject).toBe('Terminez la création de votre compte Thoughty');
      expect(link.html).toContain('lang="fr"');
      expect(link.text).toContain('saisissez le mot de passe choisi');

      const created = await call('POST /api/auth/register/complete', {
        json: { token: linkToken(link.text, '/complete-sign-up'), password: CONTRACT_PASSWORD },
        status: 201,
      });
      const accessToken = (created.body as { accessToken: string }).accessToken;
      const config = await call('GET /api/config', {
        headers: { Authorization: `Bearer ${accessToken}` },
        status: 200,
      });
      expect(config.body).toMatchObject({ language: 'fr', theme: 'light' });
    });

    it('refuses a language or a theme the app does not offer, and sends nothing', async () => {
      const email = 'refused_prefs@example.com';
      for (const preferences of [{ language: 'de' }, { theme: 'sepia' }]) {
        await call('POST /api/auth/register', {
          json: { email, password: CONTRACT_PASSWORD, website: '', ...preferences },
          status: 400,
          code: 'VALIDATION_FAILED',
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mailsTo(email)).toEqual([]);
      await expect(
        context.api.dataSource.query('SELECT COUNT(*)::int AS count FROM sign_up_requests WHERE email = $1', [email]),
      ).resolves.toEqual([{ count: 0 }]);
    });
  },
  { env: CONTRACT_SMTP_ENV, signUp: signUpWithEmail },
);
