import { describeContract, CONTRACT_PASSWORD } from './contract-suite';

/**
 * Registration that signs in at once (no mail server, outside production): racing sign-ups and
 * names taken in another case answer `409`, never a `500`. A suite of its own, as registration
 * allows five attempts per client in 15 minutes.
 */
describeContract('registration', (context) => {
  const register = (email: string, username: string, status: number, code?: 'AUTH_EMAIL_TAKEN' | 'AUTH_USERNAME_TAKEN') =>
    context.client.call('POST /api/auth/register', {
      json: { email, password: CONTRACT_PASSWORD, username, website: '' },
      status,
      code,
    });

  it('lets one of two racing registrations of an address through and answers the other 409', async () => {
    const results = await Promise.allSettled([
      register('racer@example.com', 'racer_one', 201),
      register('Racer@Example.com', 'racer_two', 201),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const [refused] = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(String(refused?.reason)).toMatch(/answered 409, expected 201[\s\S]*"code":"AUTH_EMAIL_TAKEN"/);
  });

  it('refuses a username taken in another case and signs in by it in any case', async () => {
    const { alice } = context;
    await register('other_case@example.com', alice.username.toUpperCase(), 409, 'AUTH_USERNAME_TAKEN');

    const signedIn = await context.client.call('POST /api/auth/login', {
      json: { identifier: alice.username.toUpperCase(), password: CONTRACT_PASSWORD, website: '' },
      status: 200,
    });
    expect(signedIn.body).toMatchObject({ user: { id: alice.id } });
  });
});
