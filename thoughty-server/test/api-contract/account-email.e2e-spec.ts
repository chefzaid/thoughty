import { describeContract, signUpWithEmail, CONTRACT_PASSWORD } from './contract-suite';
import { CONTRACT_SMTP_ENV, linkToken, mailTo, mailsTo, sentMail } from './contract-mail';

jest.mock('nodemailer', () => jest.requireActual('./contract-mail').fakeNodemailer);

// An account from before addresses were required holds a placeholder: it is asked for a real address
describeContract(
  'account-email',
  (context) => {
    const call: typeof context.client.call = (operation, options) =>
      context.client.call(operation, options);

    it('asks a writer with a placeholder for an address, sets it once its link is opened, and never mails the placeholder', async () => {
      const { alice, bob } = context;
      const placeholder = `user-${bob.id}@invalid`;
      await context.api.dataSource.query(
        'UPDATE users SET email = $1, email_verified = false WHERE id = $2',
        [placeholder, bob.id],
      );
      const signedIn = await call('POST /api/auth/login', {
        json: { identifier: bob.username, password: CONTRACT_PASSWORD, website: '' },
        status: 200,
      });
      expect(signedIn.body).toMatchObject({ user: { email: placeholder, emailMissing: true, emailVerified: false } });
      const writer = { ...bob, accessToken: (signedIn.body as { accessToken: string }).accessToken };

      await call('POST /api/auth/resend-verification-email', { as: writer, status: 400, code: 'AUTH_EMAIL_MISSING' });
      await call('POST /api/auth/add-email', {
        as: writer,
        json: { email: 'bob@mail.invalid' },
        status: 400,
        code: 'AUTH_EMAIL_UNDELIVERABLE',
      });
      await call('POST /api/auth/add-email', {
        as: writer,
        json: { email: alice.email.toUpperCase() },
        status: 409,
        code: 'AUTH_EMAIL_TAKEN',
      });

      const added = await call('POST /api/auth/add-email', {
        as: writer,
        json: { email: 'Bob.Real@Example.com' },
        status: 200,
      });
      expect(added.body).toMatchObject({ email: placeholder, emailMissing: true, pendingEmail: 'bob.real@example.com' });
      await call('POST /api/auth/resend-verification-email', { as: writer, status: 200 });
      const token = linkToken((await mailTo('bob.real@example.com', 2)).text, '/verify-email');

      await call('POST /api/auth/verify-email', { json: { token }, status: 200 });
      const me = await call('GET /api/auth/me', { as: writer, status: 200 });
      expect(me.body).toMatchObject({ email: 'bob.real@example.com', emailMissing: false, emailVerified: true });
      expect(me.body).not.toHaveProperty('pendingEmail');
      await call('POST /api/auth/add-email', {
        as: writer,
        json: { email: 'another@example.com' },
        status: 409,
        code: 'AUTH_EMAIL_ALREADY_SET',
      });
      expect(mailsTo(placeholder)).toEqual([]);
      expect(sentMail.some((mail) => mail.to.endsWith('.invalid') || mail.to.endsWith('@invalid'))).toBe(false);
    });
  },
  { env: CONTRACT_SMTP_ENV, signUp: signUpWithEmail },
);
