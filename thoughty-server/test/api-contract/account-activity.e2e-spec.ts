import { describeContract, readRefreshCookie, signUpWithEmail, CONTRACT_PASSWORD } from './contract-suite';
import { CONTRACT_SMTP_ENV, mailTo, mailsTo } from './contract-mail';

jest.mock('nodemailer', () => jest.requireActual('./contract-mail').fakeNodemailer);

const FIREFOX_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

interface ActivityPage {
  events: { id: number; kind: string; browser: string | null; system: string | null }[];
  nextBefore: number | null;
  newBrowserEmail: boolean;
}

/** Lets the API's background email go out before counting what was sent. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

// Sign-in allows 5 calls in 15 minutes from one address; this suite makes four.
describeContract(
  'account-activity',
  (context) => {
    const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);
    const signIn = (password: string, status: 200 | 401, userAgent: string) =>
      call('POST /api/auth/login', {
        json: { identifier: context.alice.email, password, website: '' },
        headers: { 'User-Agent': userAgent },
        status,
        ...(status === 401 ? { code: 'AUTH_INVALID_CREDENTIALS' as const } : {}),
      });
    const activity = async (as = context.alice, query?: Record<string, string>) =>
      (await call('GET /api/auth/activity', { as, query, status: 200 })).body as ActivityPage;

    it('lists sign-ins, refused sign-ins and sign-outs with their browser and system, and emails a new browser once', async () => {
      const { alice } = context;
      const signUpMails = mailsTo(alice.email).length;
      expect((await activity()).events).toEqual([expect.objectContaining({ kind: 'sign_in', browser: null, system: null })]);

      const firefox = await signIn(CONTRACT_PASSWORD, 200, FIREFOX_WINDOWS);
      const mail = await mailTo(alice.email, signUpMails + 1);
      expect(mail.subject).toBe('New sign-in to your Thoughty account');
      expect(mail.text).toContain('Firefox on Windows');
      expect(mail.text).toContain('/profile');

      await signIn(CONTRACT_PASSWORD, 200, FIREFOX_WINDOWS);
      await signIn('Wrong1234!', 401, FIREFOX_WINDOWS);
      await call('POST /api/auth/logout', {
        headers: { Cookie: readRefreshCookie(firefox.headers['set-cookie']), 'User-Agent': FIREFOX_WINDOWS },
        status: 200,
      });
      await settle();
      expect(mailsTo(alice.email)).toHaveLength(signUpMails + 1);

      const page = await activity();
      expect(page.newBrowserEmail).toBe(true);
      expect(page.nextBefore).toBeNull();
      expect(page.events.map(({ kind, browser, system }) => [kind, browser, system])).toEqual([
        ['sign_out', 'Firefox', 'Windows'],
        ['sign_in_refused', 'Firefox', 'Windows'],
        ['sign_in', 'Firefox', 'Windows'],
        ['sign_in', 'Firefox', 'Windows'],
        ['sign_in', null, null],
      ]);
      // A page after the newest events holds the older ones
      expect((await activity(alice, { before: String(page.events[1]!.id) })).events.map((event) => event.kind)).toEqual([
        'sign_in',
        'sign_in',
        'sign_in',
      ]);
      expect((await activity(context.bob)).events.map((event) => event.kind)).toEqual(['sign_in']);
    });

    it('records the data download, and keeps it in the download', async () => {
      const { alice } = context;
      const downloadData = () =>
        call('GET /api/config/download-data', { as: alice, status: 200, contentType: /^application\/json/ });
      await downloadData();
      expect((await activity()).events[0]).toMatchObject({ kind: 'data_downloaded' });
      const download = JSON.parse((await downloadData()).text) as { accountActivity: { newBrowserEmail: boolean; events: { kind: string }[] } };
      expect(download.accountActivity.newBrowserEmail).toBe(true);
      expect(download.accountActivity.events.at(-1)).toEqual(expect.objectContaining({ kind: 'data_downloaded' }));
    });

    it('sends no email for a new browser once turned off', async () => {
      const { alice } = context;
      await call('PUT /api/auth/activity/new-browser-email', {
        as: alice,
        json: { enabled: 'no' },
        status: 400,
        code: 'VALIDATION_FAILED',
      });
      await call('GET /api/auth/activity', { as: alice, query: { before: '0' }, status: 400, code: 'VALIDATION_FAILED' });
      const off = await call('PUT /api/auth/activity/new-browser-email', {
        as: alice,
        json: { enabled: false },
        status: 200,
      });
      expect(off.body).toEqual({ newBrowserEmail: false });
      const sent = mailsTo(alice.email).length;

      await signIn(CONTRACT_PASSWORD, 200, SAFARI_IPHONE);
      await settle();

      expect(mailsTo(alice.email)).toHaveLength(sent);
      const page = await activity();
      expect(page.newBrowserEmail).toBe(false);
      expect(page.events[0]).toMatchObject({ kind: 'sign_in', browser: 'Safari', system: 'iOS' });
    });
  },
  { env: CONTRACT_SMTP_ENV, signUp: signUpWithEmail },
);
