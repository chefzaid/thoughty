import { createHash } from 'node:crypto';
import {
  describeContract,
  readRefreshCookie,
  registerWriter,
  CONTRACT_PASSWORD,
} from './contract-suite';
import type { ContractUser } from './contract-client';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describeContract('auth', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const withCookie = (user: ContractUser) => ({ Cookie: user.refreshCookie });

  it('signs in with a username or an email and refuses a wrong password or a filled bot trap', async () => {
    const { alice } = context;
    const byName = await call('POST /api/auth/login', {
      json: { identifier: alice.username, password: CONTRACT_PASSWORD, website: '' },
      status: 200,
    });
    expect(byName.body).toMatchObject({ user: { id: alice.id, emailVerified: false } });
    readRefreshCookie(byName.headers['set-cookie']);
    await call('POST /api/auth/login', {
      json: { identifier: alice.email, password: 'Wrong1234!', website: '' },
      status: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    await call('POST /api/auth/login', {
      json: {
        identifier: alice.email,
        password: CONTRACT_PASSWORD,
        website: 'https://spam.example',
      },
      status: 400,
      code: 'AUTH_INVALID_REQUEST',
    });
    await call('POST /api/auth/register', {
      json: {
        email: alice.email,
        password: CONTRACT_PASSWORD,
        username: 'someone_else',
        website: '',
      },
      status: 409,
      code: 'AUTH_EMAIL_TAKEN',
    });
  });

  it('reads the signed-in writer and refuses a missing or forged token', async () => {
    const { alice } = context;
    const me = await call('GET /api/auth/me', { as: alice, status: 200 });
    expect(me.body).toMatchObject({ id: alice.id, username: alice.username, email: alice.email });
    await call('GET /api/auth/me', { status: 401, code: 'UNAUTHORIZED' });
    await call('GET /api/auth/me', {
      as: { ...alice, accessToken: 'forged' },
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('rotates the refresh cookie once and refuses the used one', async () => {
    const { bob } = context;
    const refreshed = await call('POST /api/auth/refresh', {
      headers: withCookie(bob),
      status: 200,
    });
    const rotated = readRefreshCookie(refreshed.headers['set-cookie']);
    expect(rotated).not.toBe(bob.refreshCookie);
    await call('POST /api/auth/refresh', {
      headers: withCookie(bob),
      status: 401,
      code: 'AUTH_REFRESH_TOKEN_EXPIRED',
    });
    await call('POST /api/auth/refresh', { status: 401, code: 'AUTH_REFRESH_TOKEN_MISSING' });
    bob.refreshCookie = rotated;
    bob.accessToken = (refreshed.body as { accessToken: string }).accessToken;
  });

  it('lists the sessions, revokes one and then all the others, scoped to their owner', async () => {
    const { alice, bob } = context;
    const second = await call('POST /api/auth/login', {
      json: { identifier: alice.email, password: CONTRACT_PASSWORD, website: '' },
      status: 200,
    });
    const secondCookie = readRefreshCookie(second.headers['set-cookie']);
    const listed = await call('GET /api/auth/sessions', {
      as: alice,
      headers: withCookie(alice),
      status: 200,
    });
    const sessions = listed.body as { id: number; current: boolean }[];
    expect(sessions.filter((session) => session.current)).toHaveLength(1);
    const other = sessions.find((session) => !session.current);
    const current = sessions.find((session) => session.current);
    if (!other || !current) throw new Error('Expected a current and another session');

    await call('DELETE /api/auth/sessions/{id}', {
      as: bob,
      params: { id: other.id },
      headers: withCookie(bob),
      status: 404,
      code: 'AUTH_SESSION_NOT_FOUND',
    });
    await call('DELETE /api/auth/sessions/{id}', {
      as: alice,
      params: { id: current.id },
      headers: withCookie(alice),
      status: 400,
      code: 'AUTH_SESSION_IS_CURRENT',
    });
    await call('DELETE /api/auth/sessions/{id}', {
      as: alice,
      params: { id: other.id },
      headers: withCookie(alice),
      status: 200,
    });
    await call('POST /api/auth/refresh', {
      headers: { Cookie: secondCookie },
      status: 401,
      code: 'AUTH_REFRESH_TOKEN_EXPIRED',
    });

    await call('DELETE /api/auth/sessions', {
      as: alice,
      status: 400,
      code: 'AUTH_CURRENT_REFRESH_TOKEN_REQUIRED',
    });
    await call('DELETE /api/auth/sessions', { as: alice, headers: withCookie(alice), status: 200 });
  });

  it('verifies an email and resets a password with their emailed tokens', async () => {
    const { alice } = context;
    await call('POST /api/auth/resend-verification-email', {
      as: alice,
      status: 503,
      code: 'EMAIL_DELIVERY_NOT_CONFIGURED',
    });
    // No mail server: store the token the email would have carried, hashed as the API stores it
    const verification = 'contract-verification-token';
    await context.api.dataSource.query(
      `UPDATE users SET email_verification_token = $1, email_verification_token_expires = now() + interval '1 hour' WHERE id = $2`,
      [sha256(verification), alice.id],
    );
    await call('POST /api/auth/verify-email', {
      json: { token: 'wrong' },
      status: 400,
      code: 'AUTH_INVALID_VERIFICATION_TOKEN',
    });
    await call('POST /api/auth/verify-email', { json: { token: verification }, status: 200 });
    const me = await call('GET /api/auth/me', { as: alice, status: 200 });
    expect(me.body).toMatchObject({ emailVerified: true });

    await call('POST /api/auth/forgot-password', { json: { email: alice.email }, status: 200 });
    await call('POST /api/auth/forgot-password', {
      json: { email: 'nobody@example.com' },
      status: 200,
    });
    const reset = 'contract-reset-token';
    await context.api.dataSource.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = now() + interval '1 hour' WHERE id = $2`,
      [sha256(reset), alice.id],
    );
    await call('POST /api/auth/reset-password', {
      json: { token: 'wrong', newPassword: 'Reset1234!' },
      status: 400,
      code: 'AUTH_INVALID_RESET_TOKEN',
    });
    await call('POST /api/auth/reset-password', {
      json: { token: reset, newPassword: 'Reset1234!' },
      status: 200,
    });
    await call('POST /api/auth/change-password', {
      as: alice,
      json: { currentPassword: 'Wrong1234!', newPassword: CONTRACT_PASSWORD },
      status: 401,
      code: 'AUTH_CURRENT_PASSWORD_INCORRECT',
    });
    await call('POST /api/auth/change-password', {
      as: alice,
      json: { currentPassword: 'Reset1234!', newPassword: CONTRACT_PASSWORD },
      status: 200,
    });
  });

  it('offers two-factor sign-in only where mail can be sent', async () => {
    const { alice, bob } = context;
    const status = await call('GET /api/auth/two-factor/status', { as: alice, status: 200 });
    expect(status.body).toEqual({ enabled: false, available: false, emailVerified: true });
    await call('POST /api/auth/two-factor/setup', {
      as: bob,
      status: 400,
      code: 'AUTH_2FA_EMAIL_NOT_VERIFIED',
    });
    await call('POST /api/auth/two-factor/setup', {
      as: alice,
      status: 503,
      code: 'EMAIL_DELIVERY_NOT_CONFIGURED',
    });
    await call('POST /api/auth/two-factor/enable', {
      as: alice,
      json: { challengeToken: 'forged', code: '123456' },
      status: 401,
      code: 'AUTH_2FA_INVALID_CHALLENGE',
    });
    await call('POST /api/auth/two-factor/disable', {
      as: alice,
      json: { password: 'Wrong1234!' },
      status: 401,
      code: 'AUTH_INVALID_PASSWORD',
    });
    // Turning it off is idempotent
    await call('POST /api/auth/two-factor/disable', {
      as: alice,
      json: { password: CONTRACT_PASSWORD },
      status: 200,
    });
    await call('POST /api/auth/two-factor/verify', {
      json: { challengeToken: 'forged', code: '123456' },
      status: 401,
      code: 'AUTH_2FA_INVALID_CHALLENGE',
    });
    await call('POST /api/auth/two-factor/resend', {
      json: { challengeToken: 'forged' },
      status: 401,
      code: 'AUTH_2FA_INVALID_CHALLENGE',
    });
  });

  it('refuses Google and Keycloak sign-in when they are not configured', async () => {
    await call('POST /api/auth/oauth', {
      json: { provider: 'google', credential: 'not-a-google-token' },
      status: 503,
      code: 'AUTH_GOOGLE_NOT_CONFIGURED',
    });
    await call('GET /api/auth/sso', { status: 401, code: 'AUTH_KEYCLOAK_TOKEN_MISSING' });
  });

  it('signs out and deletes an account after its password is confirmed', async () => {
    const carol = await registerWriter(context.client, 'carol_auth');
    const loggedOut = await call('POST /api/auth/logout', {
      headers: { Cookie: carol.refreshCookie },
      status: 200,
    });
    expect(String(loggedOut.headers['set-cookie'])).toContain('thoughty_refresh_token=;');
    await call('POST /api/auth/refresh', {
      headers: { Cookie: carol.refreshCookie },
      status: 401,
      code: 'AUTH_REFRESH_TOKEN_EXPIRED',
    });
    await call('POST /api/auth/delete-account', {
      as: carol,
      json: { password: 'Wrong1234!' },
      status: 401,
      code: 'AUTH_INVALID_PASSWORD',
    });
    await call('POST /api/auth/delete-account', {
      as: carol,
      json: { password: CONTRACT_PASSWORD },
      status: 200,
    });
    // A deleted account signs in like an unknown one, so the answer does not reveal it existed
    await call('POST /api/auth/login', {
      json: { identifier: carol.email, password: CONTRACT_PASSWORD, website: '' },
      status: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });
});
