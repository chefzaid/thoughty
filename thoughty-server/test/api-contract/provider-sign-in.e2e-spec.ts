import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { describeContract, readRefreshCookie, registerWriter, CONTRACT_PASSWORD } from './contract-suite';

const GOOGLE_CLIENT_ID = 'contract-client.apps.googleusercontent.com';
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const KEYCLOAK_ISSUER = 'https://keycloak.contract.test/realms/thoughty';
const KEYCLOAK_JWKS_URI = `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`;
const KEYCLOAK_AUDIENCE = 'thoughty-contract';

/** A fake provider's key pair: the suite signs tokens with it, and the API fetches its public half. */
function fakeProvider(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    jwks: { keys: [{ ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' }] },
    sign: (claims: object, issuer: string, audience: string) =>
      new JwtService().sign(claims, {
        privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }),
        algorithm: 'RS256',
        keyid: kid,
        issuer,
        audience,
        expiresIn: '5m',
      }),
  };
}

const google = fakeProvider('google-contract');
const keycloak = fakeProvider('keycloak-contract');

const googleCredential = (sub: string, email: string, name: string, emailVerified = true) =>
  google.sign({ sub, email, email_verified: emailVerified, name }, 'https://accounts.google.com', GOOGLE_CLIENT_ID);
const keycloakToken = (sub: string, email: string, preferredUsername: string) =>
  keycloak.sign(
    { sub, email, email_verified: true, preferred_username: preferredUsername },
    KEYCLOAK_ISSUER,
    KEYCLOAK_AUDIENCE,
  );

interface SignedIn {
  user: { id: number; username: string; email: string; authProvider: string; emailVerified: boolean; isNewUser?: boolean };
}

// Google sign-in allows 5 calls per 15 minutes from one address; this suite makes 4.
describeContract(
  'provider-sign-in',
  (context) => {
    const call: typeof context.client.call = (operation, options) =>
      context.client.call(operation, options);
    const withGoogle = async (credential: string, status = 200) =>
      call('POST /api/auth/oauth', { json: { provider: 'google', credential }, status });
    const withKeycloak = async (token: string) =>
      call('GET /api/auth/sso', { headers: { 'x-auth-request-access-token': token }, status: 200 });

    it('takes over an unverified account for the Google user who proves its address', async () => {
      // No mail server: registration signs the registrant in at once, with the address unproven
      const registrant = await registerWriter(context.client, 'victim');

      const signedIn = await withGoogle(googleCredential('google-victim', registrant.email, 'Victim'));

      expect((signedIn.body as SignedIn).user).toMatchObject({
        id: registrant.id,
        username: 'victim',
        authProvider: 'google',
        emailVerified: true,
        isNewUser: false,
      });
      readRefreshCookie(signedIn.headers['set-cookie']);
      // The registrant's password and session no longer get in
      await call('POST /api/auth/login', {
        json: { identifier: registrant.email, password: CONTRACT_PASSWORD, website: '' },
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
      });
      await call('POST /api/auth/refresh', {
        headers: { Cookie: registrant.refreshCookie },
        status: 401,
        code: 'AUTH_REFRESH_TOKEN_EXPIRED',
      });
    });

    it('refuses a Google address Google has not verified, and touches no account', async () => {
      const { alice } = context;
      await call('POST /api/auth/oauth', {
        json: { provider: 'google', credential: googleCredential('google-alice', alice.email, 'Alice', false) },
        status: 401,
        code: 'AUTH_GOOGLE_EMAIL_UNVERIFIED',
      });
      await call('POST /api/auth/login', {
        json: { identifier: alice.email, password: CONTRACT_PASSWORD, website: '' },
        status: 200,
      });
    });

    it('gives a second Google "Jane Doe" a free username instead of failing', async () => {
      const first = await withGoogle(googleCredential('google-jane-1', 'jane1@example.com', 'Jane Doe'));
      const second = await withGoogle(googleCredential('google-jane-2', 'jane2@example.com', 'Jane Doe'));

      expect((first.body as SignedIn).user).toMatchObject({ username: 'Jane Doe', isNewUser: true });
      expect((second.body as SignedIn).user).toMatchObject({ email: 'jane2@example.com', isNewUser: true });
      expect((second.body as SignedIn).user.username).toMatch(/^Jane Doe-\d{6}$/);
    });

    it('creates a Keycloak account under a free name and finds it by subject from then on', async () => {
      const { alice } = context;
      const created = await withKeycloak(keycloakToken('kc-new', 'kc-new@example.com', alice.username));
      const user = (created.body as SignedIn).user;
      expect(user).toMatchObject({ authProvider: 'keycloak', isNewUser: true, emailVerified: true });
      expect(user.username).toMatch(new RegExp(`^${alice.username}-\\d{6}$`));

      const again = await withKeycloak(keycloakToken('kc-new', 'renamed@example.com', 'renamed'));
      expect((again.body as SignedIn).user).toMatchObject({ id: user.id, email: 'kc-new@example.com', isNewUser: false });
    });

    it('links a verified account to Keycloak and keeps its password', async () => {
      const { bob } = context;
      await context.api.dataSource.query('UPDATE users SET email_verified = true WHERE id = $1', [bob.id]);

      const linked = await withKeycloak(keycloakToken('kc-bob', bob.email, 'bob'));

      expect((linked.body as SignedIn).user).toMatchObject({ id: bob.id, username: bob.username, authProvider: 'keycloak' });
      await call('POST /api/auth/login', {
        json: { identifier: bob.email, password: CONTRACT_PASSWORD, website: '' },
        status: 200,
      });
      await call('POST /api/auth/refresh', { headers: { Cookie: bob.refreshCookie }, status: 200 });
    });
  },
  {
    env: {
      GOOGLE_CLIENT_ID,
      KEYCLOAK_ISSUER,
      KEYCLOAK_AUDIENCE,
      KEYCLOAK_JWKS_URI,
    },
    outboundJson: { [GOOGLE_JWKS_URI]: google.jwks, [KEYCLOAK_JWKS_URI]: keycloak.jwks },
  },
);
