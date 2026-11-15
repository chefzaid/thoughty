import {
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
} from '../../src/database/postgres-test-database.test-helpers';
import { startContractApi, type ContractApi, type ContractApiOptions } from './contract-app';
import { ContractClient, type ContractUser } from './contract-client';
import { CONTRACT_SUITES, type ContractSuiteName } from './contract-operations';
import { linkToken, mailTo } from './contract-mail';

export const CONTRACT_PASSWORD = 'Contract1234!';

export interface ContractContext {
  api: ContractApi;
  client: ContractClient;
  /** The writer whose data the suite reads and changes. */
  alice: ContractUser;
  /** A second writer, to check each route keeps to the caller's own data. */
  bob: ContractUser;
}

/** The refresh cookie a sign-in sets, as the browser sends it back (`name=value`). */
export function readRefreshCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((value) => value.startsWith('thoughty_refresh_token='));
  if (!cookie) throw new Error('The API set no refresh token cookie');
  return cookie.split(';')[0] ?? '';
}

/**
 * Registers a writer with the web's sign-up request: its fields, and the empty bot trap. The
 * contract API has no mail server, so outside production it signs the writer in at once.
 */
export async function registerWriter(
  client: ContractClient,
  username: string,
): Promise<ContractUser> {
  const email = `${username}@example.com`;
  const response = await client.call('POST /api/auth/register', {
    json: { email, password: CONTRACT_PASSWORD, username, website: '' },
    status: 201,
  });
  const body = response.body as { user: { id: number }; accessToken: string };
  return {
    id: body.user.id,
    username,
    email,
    password: CONTRACT_PASSWORD,
    accessToken: body.accessToken,
    refreshCookie: readRefreshCookie(response.headers['set-cookie']),
  };
}

/** What registration answers wherever the server can send email. */
export const SIGN_UP_STARTED = {
  verificationRequired: true,
  message: 'Check your email to finish creating your account.',
};

/**
 * Signs a writer up the way production does: the form, then the emailed link. For a suite with
 * a mail server (`contract-mail.ts`).
 */
export async function signUpWithEmail(
  client: ContractClient,
  username: string,
): Promise<ContractUser> {
  const email = `${username}@example.com`;
  const started = await client.call('POST /api/auth/register', {
    json: { email, password: CONTRACT_PASSWORD, username, website: '' },
    status: 202,
  });
  expect(started.body).toEqual(SIGN_UP_STARTED);
  expect(started.headers['set-cookie']).toBeUndefined();
  const token = linkToken((await mailTo(email)).text, '/complete-sign-up');
  const completed = await client.call('POST /api/auth/register/complete', {
    json: { token, password: CONTRACT_PASSWORD },
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

export interface ContractSuiteOptions extends ContractApiOptions {
  /** How the suite's two writers sign up; `registerWriter` by default. */
  signUp?: (client: ContractClient, username: string) => Promise<ContractUser>;
}

/**
 * A real-API contract suite: the whole API on a database of its own, with two registered writers.
 * After its tests it checks it called every operation `CONTRACT_SUITES[name]` lists.
 */
export function describeContract(
  name: ContractSuiteName,
  defineTests: (context: ContractContext) => void,
  { signUp = registerWriter, ...apiOptions }: ContractSuiteOptions = {},
): void {
  describePostgres(`API contract: ${name}`, () => {
    const context = {} as ContractContext;

    beforeAll(async () => {
      context.api = await startContractApi(apiOptions);
      context.client = new ContractClient(context.api.http, () =>
        context.api.logger.lines.length > 0
          ? `\nAPI log:\n  ${context.api.logger.lines.slice(-5).join('\n  ')}`
          : '',
      );
      context.alice = await signUp(context.client, `alice_${name}`);
      context.bob = await signUp(context.client, `bob_${name}`);
    }, POSTGRES_SETUP_TIMEOUT_MS);

    afterAll(async () => {
      await context.api?.close();
    });

    defineTests(context);

    it('called every operation it covers', () => {
      const missed = CONTRACT_SUITES[name].filter(
        (operation) => !context.client.called.has(operation),
      );
      expect(missed).toEqual([]);
    });
  });
}
